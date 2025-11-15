import duckdb from 'duckdb';
import fs from 'fs';
import path from 'path';

type SummaryRow = {
  keyword: string;
  searches: number;
  clicks: number;
  revenue: number;
  ctr: number | null;
  rpc: number | null;
  rps: number | null;
  category?: string | null;
};

function ensureDir(dirPath: string): void {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function getOutputDir(): string {
  const today = new Date();
  const iso = today.toISOString().slice(0, 10);
  const out = path.resolve(
    __dirname,
    '../../runs/system1',
    iso
  );
  ensureDir(out);
  return out;
}

function getInputPathFromArgs(): string {
  const arg = process.argv.find((a) => a.startsWith('--input='));
  if (arg) {
    return arg.split('=')[1];
  }
  // Default to the file the user attached on Desktop
  return '/Users/ericroach/Desktop/Keyword with Slug_2025-10-30_scott.csv';
}

function getFlagBoolean(name: string, defaultValue: boolean): boolean {
  const prefix = `--${name}=`;
  const arg = process.argv.find((a) => a.startsWith(prefix));
  if (!arg) return defaultValue;
  const v = arg.slice(prefix.length).toLowerCase();
  if (v === '1' || v === 'true' || v === 'yes') return true;
  if (v === '0' || v === 'false' || v === 'no') return false;
  return defaultValue;
}

function getFlagNumber(name: string, defaultValue: number): number {
  const prefix = `--${name}=`;
  const arg = process.argv.find((a) => a.startsWith(prefix));
  if (!arg) return defaultValue;
  const n = Number(arg.slice(prefix.length));
  return Number.isFinite(n) ? n : defaultValue;
}

async function run(): Promise<void> {
  const inputPath = getInputPathFromArgs();
  if (!fs.existsSync(inputPath)) {
    console.error(`Input file not found: ${inputPath}`);
    process.exit(1);
  }

  const db = new duckdb.Database(':memory:');

  const conn: any = db.connect();

  const exec = (sql: string): Promise<void> =>
    new Promise((resolve, reject) => {
      (conn as any).run(sql, (err: Error | null) => {
        if (err) reject(err);
        else resolve();
      });
    });

  const all = (sql: string): Promise<any[]> =>
    new Promise((resolve, reject) => {
      (conn as any).all(sql, (err: Error | null, rows: any[]) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });

  // Create a table from the CSV. Try pivoted format first; on failure, fall back to flat schema with SERP_KEYWORD/REGION_CODE.
  const escapedPath = inputPath.replace(/'/g, "''");
  let pivotLoaded = true;
  try {
    await exec(`
      CREATE TABLE raw AS
      SELECT * FROM read_csv_auto(
        '${escapedPath}',
        header=true,
        skip=4,
        all_varchar=true,
        ignore_errors=true,
        delim=',',
        quote='"'
      );
    `);

    // Normalize expected pivot columns
    await exec(`
      CREATE VIEW cleaned AS
      SELECT
        row_number() OVER () AS row_id,
        trim("Row Labels") AS row_label,
        TRY_CAST(REPLACE("Sum of SELLSIDE_SEARCHES", ',', '') AS DOUBLE) AS searches,
        TRY_CAST(REPLACE("Sum of SELLSIDE_CLICKS_NETWORK", ',', '') AS DOUBLE) AS clicks,
        TRY_CAST(REPLACE("Sum of EST_NET_REVENUE", ',', '') AS DOUBLE) AS revenue,
        TRY_CAST(REPLACE("Sum of RPS", ',', '') AS DOUBLE) AS rps,
        TRY_CAST(REPLACE("Sum of RPC", ',', '') AS DOUBLE) AS rpc
      FROM raw
      WHERE trim("Row Labels") IS NOT NULL AND trim("Row Labels") <> ''
    `);

    // Infer state from pivot: whenever row_label is two-letter state, carry forward to subsequent keyword rows
    await exec(`
      CREATE VIEW annotated AS
      SELECT
        row_id,
        row_label,
        searches,
        clicks,
        revenue,
        rps,
        rpc,
        CASE WHEN regexp_matches(row_label, '^[A-Z]{2}$') THEN row_label ELSE NULL END AS state_label
      FROM cleaned
    `);

    await exec(`
      CREATE VIEW grouped AS
      SELECT
        *,
        CASE WHEN state_label IS NULL THEN 0 ELSE 1 END AS is_state,
        SUM(CASE WHEN state_label IS NULL THEN 0 ELSE 1 END)
          OVER (ORDER BY row_id ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS grp
      FROM annotated
    `);

    await exec(`
      CREATE VIEW with_state AS
      SELECT
        *,
        MAX(state_label) OVER (PARTITION BY grp) AS state,
        NULL::VARCHAR AS content_slug
      FROM grouped
    `);
  } catch (e) {
    // Fall back to flat schema
    pivotLoaded = false;
    await exec(`DROP VIEW IF EXISTS with_state; DROP VIEW IF EXISTS grouped; DROP VIEW IF EXISTS annotated; DROP VIEW IF EXISTS cleaned; DROP TABLE IF EXISTS raw;`);
    await exec(`
      CREATE TABLE raw AS
      SELECT * FROM read_csv_auto(
        '${escapedPath}',
        header=true,
        all_varchar=true,
        ignore_errors=true,
        delim=',',
        quote='"'
      );
    `);
    await exec(`
      CREATE VIEW with_state AS
      SELECT
        row_number() OVER () AS row_id,
        trim(COALESCE("SERP_KEYWORD", '')) AS row_label,
        NULLIF(trim(COALESCE("REGION_CODE", '')), 'None') AS state,
        trim(COALESCE("CONTENT_SLUG", '')) AS content_slug,
        TRY_CAST(REPLACE(COALESCE("SELLSIDE_SEARCHES", ''), ',', '') AS DOUBLE) AS searches,
        TRY_CAST(REPLACE(COALESCE("SELLSIDE_CLICKS_NETWORK", ''), ',', '') AS DOUBLE) AS clicks,
        TRY_CAST(REPLACE(COALESCE("EST_NET_REVENUE", ''), ',', '') AS DOUBLE) AS revenue
      FROM raw
      WHERE trim(COALESCE("SERP_KEYWORD", '')) <> ''
    `);
  }

  // Filter out 2-letter state totals (e.g., AK, AL) and keep only keyword rows
  await exec(`
    CREATE VIEW keywords AS
    SELECT * FROM with_state
    WHERE NOT regexp_matches(row_label, '^[A-Z]{2}$')
  `);

  // Basic sanity metrics
  const totals = await all(`
    SELECT
      SUM(searches) AS searches,
      SUM(clicks) AS clicks,
      SUM(revenue) AS revenue
    FROM keywords
  `);

  // Normalize/aggregate by canonical keyword string
  await exec(`
    CREATE VIEW canon AS
    SELECT
      lower(regexp_replace(row_label, '\\s+', ' ', 'g')) AS keyword,
      SUM(searches) AS searches,
      SUM(clicks) AS clicks,
      SUM(revenue) AS revenue
    FROM keywords
    GROUP BY 1
  `);

  // State-level canonical aggregation
  await exec(`
    CREATE VIEW canon_state AS
    SELECT
      state,
      lower(regexp_replace(row_label, '\\s+', ' ', 'g')) AS keyword,
      SUM(searches) AS searches,
      SUM(clicks) AS clicks,
      SUM(revenue) AS revenue
    FROM keywords
    GROUP BY 1, 2
  `);

  await exec(`
    CREATE VIEW canon_metrics AS
    SELECT
      keyword,
      searches,
      clicks,
      revenue,
      CASE WHEN searches > 0 THEN clicks / searches ELSE NULL END AS ctr,
      CASE WHEN clicks > 0 THEN revenue / clicks ELSE NULL END AS rpc,
      CASE WHEN searches > 0 THEN revenue / searches ELSE NULL END AS rps
    FROM canon
  `);

  await exec(`
    CREATE VIEW canon_metrics_state AS
    SELECT
      state,
      keyword,
      searches,
      clicks,
      revenue,
      CASE WHEN searches > 0 THEN clicks / searches ELSE NULL END AS ctr,
      CASE WHEN clicks > 0 THEN revenue / clicks ELSE NULL END AS rpc,
      CASE WHEN searches > 0 THEN revenue / searches ELSE NULL END AS rps
    FROM canon_state
  `);

  // Simple intent clustering via keyword patterns
  await exec(`
    CREATE VIEW canon_clustered AS
    SELECT
      keyword,
      searches,
      clicks,
      revenue,
      ctr,
      rpc,
      rps,
      CASE
        WHEN keyword LIKE '%loan%' OR keyword LIKE '%cash%' OR keyword LIKE '%payday%' THEN 'Loans / Cash'
        WHEN keyword LIKE '%clinical%' OR keyword LIKE '%trial%' OR keyword LIKE '%study%' THEN 'Clinical Trials'
        WHEN keyword LIKE '%depression%' OR keyword LIKE '%anxiety%' THEN 'Mental Health Trials'
        WHEN keyword LIKE '%erectile%' OR keyword LIKE '%ed%' THEN 'ED Trials'
        WHEN keyword LIKE '%medicare%' OR keyword LIKE '%flex card%' OR keyword LIKE '%giveback%' THEN 'Medicare Benefits'
        WHEN keyword LIKE '%adhd%' OR keyword LIKE '%prescription%' THEN 'Online Rx / ADHD'
        WHEN keyword LIKE '%casino%' OR keyword LIKE '%real money%' THEN 'Casino / Gambling'
        WHEN keyword LIKE '%insurance%' OR keyword LIKE '%bundle%' THEN 'Insurance'
        WHEN keyword LIKE '%checking bonus%' OR keyword LIKE '%open account%' THEN 'Bank Bonuses'
        WHEN keyword LIKE '%free phone%' OR keyword LIKE '%government cell%' THEN 'Free Phone / ACP'
        WHEN keyword LIKE '%dental implant%' THEN 'Dental Implants'
        WHEN keyword LIKE '%coolsculpt%' OR keyword LIKE '%belly fat%' OR keyword LIKE '%weight%'
          THEN 'Weight Loss / Body Contour'
        ELSE 'Other'
      END AS category
    FROM canon_metrics
  `);

  // Angle taxonomy (subset) for deeper grouping within categories
  await exec(`
    CREATE VIEW canon_angles AS
    SELECT
      keyword,
      searches,
      clicks,
      revenue,
      ctr,
      rpc,
      rps,
      CASE
        -- Finance/Commerce
        WHEN keyword LIKE '%insurance%' OR keyword LIKE '%quote%' OR keyword LIKE '%full coverage%' THEN 'Insurance Quotes'
        WHEN keyword LIKE '%loan%' OR keyword LIKE '%cash%' OR keyword LIKE '%payday%' THEN 'Loans'
        WHEN keyword LIKE '%get money in my bank account now%' OR keyword LIKE '%emergency fund%'
          THEN 'Loans'
        WHEN keyword LIKE '%checking bonus%' OR keyword LIKE '%open account%' THEN 'Bank Bonuses'
        -- Finance expansions: bank bonuses and debt relief
        WHEN keyword LIKE '%checking offer%' OR keyword LIKE '%checking account bonus%' OR keyword LIKE '%bank account bonus%' OR keyword LIKE '%cash bonus checking%'
          OR keyword LIKE '%banks that give you money%' THEN 'Bank Bonuses'
        WHEN keyword LIKE '%start a bank account online%'
          OR (keyword LIKE '%open checking account online%' AND keyword LIKE '%no deposit%')
          THEN 'Bank Bonuses'
        WHEN keyword LIKE '%debt relief%' OR keyword LIKE '%credit card debt relief%' OR keyword LIKE '%debt consolidation%'
          OR keyword LIKE '%debt settlement%' OR keyword LIKE '%national debt relief%' THEN 'Debt Relief'
        WHEN keyword LIKE '%fsa %' OR keyword LIKE 'fsa%' OR keyword LIKE '% hsa%' OR keyword LIKE '%hsa %' OR keyword LIKE '%eligible item%' THEN 'FSA / HSA'
        -- Telecom / ACP free phone & internet
        WHEN keyword LIKE '%free phone%' OR keyword LIKE '%free smartphone%' OR keyword LIKE '%government phone%' OR keyword LIKE '%acp%'
          OR keyword LIKE '%lifeline%' OR keyword LIKE '%affordable connectivity%' THEN 'ACP / Free Phone'
        WHEN (keyword LIKE '%no cost%' OR keyword LIKE '%$0 %') AND (keyword LIKE '%phone%' OR keyword LIKE '%smartphone%')
          THEN 'ACP / Free Phone'
        WHEN keyword LIKE '%google pixel%'
          THEN 'ACP / Free Phone'
        WHEN keyword LIKE '%$10 internet%' OR keyword LIKE '%internet for seniors%' OR keyword LIKE '%internet providers in my zip%'
          OR keyword LIKE '%internet near me%' OR keyword LIKE '%cheap internet%' THEN 'Internet Plans'
        -- ACP / Internet brand captures
        WHEN keyword LIKE '%assurance wireless%' OR keyword LIKE '%safelink%' OR keyword LIKE '%qlink%'
          OR keyword LIKE '%truconnect%' OR keyword LIKE '%standup wireless%'
          THEN 'ACP / Free Phone'
        WHEN keyword LIKE '%xfinity%' OR keyword LIKE '%comcast%' OR keyword LIKE '%spectrum%'
          OR keyword LIKE '%cox%' OR keyword LIKE '%fios%' OR keyword LIKE '%att fiber%'
          THEN 'Internet Plans'
        -- Health Trials & Telehealth
        WHEN keyword LIKE '%clinical%' OR keyword LIKE '%trial%' OR keyword LIKE '%study%' THEN 'Clinical Trials'
        WHEN keyword LIKE '%adhd%' OR keyword LIKE '%adderall%' OR keyword LIKE '%telehealth%' OR keyword LIKE '%prescription%' THEN 'ADHD / Online Rx'
        -- Male health
        WHEN keyword LIKE '%erectile%' OR keyword LIKE '%ed %' OR keyword LIKE 'ed %' THEN 'ED'
        -- Dental/Implants
        WHEN keyword LIKE '%dental implant%' OR keyword LIKE '%full mouth%implant%' THEN 'Dental Implants'
        WHEN keyword LIKE '%dentures%' THEN 'Dental: Dentures'
        WHEN keyword LIKE '%invisalign%' OR keyword LIKE '%braces%' THEN 'Dental: Orthodontics'
        WHEN keyword LIKE '%teeth whitening%' OR keyword LIKE '%whitening strips%' THEN 'Dental: Whitening'
        -- Weight loss/body contour
        WHEN keyword LIKE '%coolsculpt%' OR keyword LIKE '%belly fat%' OR keyword LIKE '%weight loss%' OR keyword LIKE '%semaglutide%' OR keyword LIKE '%glp-1%' THEN 'Weight Loss / Body Contour'
        -- Medicare/benefits
        WHEN keyword LIKE '%medicare%' OR keyword LIKE '%flex card%' OR keyword LIKE '%giveback%' THEN 'Medicare Benefits'
        WHEN keyword LIKE '%healthy benefits plus%' OR keyword LIKE '%benefit allowance%'
          THEN 'Medicare Benefits'
        -- Entertainment
        WHEN keyword LIKE '%casino%' OR keyword LIKE '%real money%' THEN 'Casino / Real Money'
        -- Travel / Cruises
        WHEN (keyword LIKE '%cruise%' AND keyword LIKE '%mississippi%')
          OR keyword LIKE '%viking cruise%'
          OR keyword LIKE '%viking river%'
          OR keyword LIKE '%american cruise lines%'
          THEN 'Travel: Cruises'
        -- Automotive
        WHEN keyword LIKE '%nissan%' OR keyword LIKE '%rogue%'
          OR keyword LIKE '%jeep%' OR keyword LIKE '%cherokee%'
          THEN 'Automotive'
        -- Services & Careers (revenue-first expansions)
        WHEN keyword LIKE '%home remodeling%' OR keyword LIKE '%home repair%' OR keyword LIKE '%remodeling companies%'
          OR keyword LIKE '%contractors near me%' OR keyword LIKE '%tree removal%' OR keyword LIKE '%generator installation%'
          THEN 'Home Services'
        WHEN keyword LIKE '%warehouse job%' OR keyword LIKE '%jobs near me%' OR keyword LIKE '%hiring near me%' OR keyword LIKE '%careers%'
          THEN 'Careers / Jobs'
        WHEN keyword LIKE '%first time home buyer%' OR keyword LIKE '%no money down%' OR keyword LIKE '%rent to own%'
          THEN 'Real Estate'
        -- Personal finance & investing
        WHEN keyword LIKE '%credit repair%' OR keyword LIKE '%raise credit score%' OR keyword LIKE '%boost credit score%'
          THEN 'Credit Repair'
        WHEN keyword LIKE '%investing%' OR keyword LIKE '%retirement income%' OR keyword LIKE '%ira%'
          OR keyword LIKE '%401k%' OR keyword LIKE '%index fund%' OR keyword LIKE '%mutual fund%'
          THEN 'Investing'
        -- Bank bonus brand captures
        WHEN keyword LIKE '%chase checking bonus%' OR keyword LIKE '%wells fargo checking bonus%'
          OR keyword LIKE '%citi checking bonus%' OR keyword LIKE '%bank of america checking bonus%'
          THEN 'Bank Bonuses'
        -- Legal services
        WHEN keyword LIKE '%personal injury%' OR keyword LIKE '%injury claim%' OR keyword LIKE '%accident lawyer%'
          OR keyword LIKE '%car accident lawyer%' OR keyword LIKE '%workers compensation%'
          THEN 'Legal: Personal Injury'
        WHEN keyword LIKE '%ssdi%' OR keyword LIKE '%disability lawyer%' OR keyword LIKE '%disability attorneys%'
          OR keyword LIKE '%do i qualify for disability%'
          THEN 'Legal: SSDI'
        WHEN keyword LIKE '%medical malpractice%'
          THEN 'Legal: Malpractice'
        -- Education
        WHEN keyword LIKE '%online degree%' OR keyword LIKE '%online colleges%' OR keyword LIKE '%online schools%'
          OR keyword LIKE '%grants to go back to school%'
          THEN 'Education'
        -- Senior living & alerts
        WHEN keyword LIKE '%senior living%' OR keyword LIKE '%memory care%' OR keyword LIKE '%independent living%'
          OR keyword LIKE '%housing for seniors%'
          THEN 'Senior Living'
        WHEN keyword LIKE '%medical alert%' OR keyword LIKE '%alert devices%'
          THEN 'Medical Alerts'
        -- Hearing & dental assistance
        WHEN keyword LIKE '%hearing aid%' OR keyword LIKE '%free hearing%'
          THEN 'Health: Hearing Aids'
        WHEN keyword LIKE '%oticon%' OR keyword LIKE '%phonak%' OR keyword LIKE '%widex%' OR keyword LIKE '%resound%' OR keyword LIKE '%audien%'
          THEN 'Health: Hearing Aids'
        WHEN keyword LIKE '%free dental%' OR keyword LIKE '%dental discount plan%' OR keyword LIKE '%dental plans for seniors%'
          THEN 'Dental: Assistance'
        -- Sleep / Insomnia
        WHEN keyword LIKE '%insomnia%' OR keyword LIKE '%sleep aid%'
          THEN 'Health: Insomnia'
        -- Herpes
        WHEN keyword LIKE '%herpes%'
          THEN 'Health: Herpes'
        -- Allergies
        WHEN keyword LIKE '%allergy%' OR keyword LIKE '%antihistamine%'
          THEN 'Health: Allergies'
        -- Pharmacy / Coupons
        WHEN keyword LIKE '%goodrx%' OR keyword LIKE '%coupon%'
          THEN 'Pharmacy Discounts'
        -- Aesthetics / Dermatology brands
        WHEN keyword LIKE '%botox%' OR keyword LIKE '%juvederm%' OR keyword LIKE '%fillers%'
          THEN 'Health: Dermatology'
        -- Home services brands
        WHEN keyword LIKE '%generac%' OR keyword LIKE '%servpro%' OR keyword LIKE '%roto-rooter%'
          THEN 'Home Services'
        -- Health sub-angles (expand "Other")
        WHEN keyword LIKE '%hemorrhoid%' OR keyword LIKE '%sitz bath%' OR keyword LIKE '%anal fissure%' THEN 'Health: GI/Anorectal'
        WHEN keyword LIKE '%constipation%' OR keyword LIKE '%miralax%' OR keyword LIKE '%colace%' OR keyword LIKE '%laxative%' THEN 'Health: GI/Constipation'
        WHEN keyword LIKE '%ibs%' OR keyword LIKE '%irritable bowel%' THEN 'Health: GI/IBS'
        WHEN keyword LIKE '%gerd%' OR keyword LIKE '%acid reflux%' OR keyword LIKE '%heartburn%' THEN 'Health: GI/GERD'
        WHEN keyword LIKE '%diarrhea%' OR keyword LIKE '%antidiarrheal%' THEN 'Health: GI/Diarrhea'
        WHEN keyword LIKE '%colonoscopy%' OR keyword LIKE '%colonoscopy prep%' THEN 'Health: Procedure/Colonoscopy'
        -- GI brand expansions (revenue-first)
        WHEN keyword LIKE '%omeprazole%' OR keyword LIKE '%prilosec%' OR keyword LIKE '%esomeprazole%' OR keyword LIKE '%nexium%' OR keyword LIKE '%famotidine%' OR keyword LIKE '%pepcid%' OR keyword LIKE '%zantac%' OR keyword LIKE '%antacid%' OR keyword LIKE '%gaviscon%' OR keyword LIKE '%maalox%' OR keyword LIKE '%tums%'
          THEN 'Health: GI/GERD'
        WHEN keyword LIKE '%dulcolax%' OR keyword LIKE '%senokot%' OR keyword LIKE '%bisacodyl%' OR keyword LIKE '%metamucil%' OR keyword LIKE '%psyllium%' OR keyword LIKE '%fibercon%'
          THEN 'Health: GI/Constipation'
        WHEN keyword LIKE '%golytely%' OR keyword LIKE '%moviprep%' OR keyword LIKE '%suprep%' OR keyword LIKE '%prepopik%' OR keyword LIKE '%clenpiq%' OR keyword LIKE '%sutab%' OR keyword LIKE '%osmoprep%'
          THEN 'Health: Procedure/Colonoscopy'
        WHEN keyword LIKE '%uti%' OR keyword LIKE '%urinary tract%' OR keyword LIKE '%bladder%' THEN 'Health: Urology'
        WHEN keyword LIKE '%cataract%' OR keyword LIKE '%pink eye%' OR keyword LIKE '%conjunctivitis%' OR keyword LIKE '%eye drop%'
          THEN 'Health: Eye'
        WHEN keyword LIKE '%dry eye%' OR keyword LIKE '%artificial tears%' THEN 'Health: Eye/Dry Eye'
        WHEN keyword LIKE '%glaucoma%' THEN 'Health: Eye/Glaucoma'
        WHEN keyword LIKE '%eye floater%' OR keyword LIKE '%floaters%'
          THEN 'Health: Eye/Floaters'
        -- Eye OTC brands
        WHEN keyword LIKE '%systane%' OR keyword LIKE '%refresh%' OR keyword LIKE '%theratears%' OR keyword LIKE '%visine%' OR keyword LIKE '%zaditor%' OR keyword LIKE '%pataday%'
          THEN 'Health: Eye/Dry Eye'
        WHEN keyword LIKE '%iols%' OR keyword LIKE '%intraocular lens%' OR keyword LIKE '%lens implant%' OR keyword LIKE '%cataract surgery%'
          THEN 'Health: Eye/Cataract'
        WHEN keyword LIKE '%eczema%' OR keyword LIKE '%psoriasis%' OR keyword LIKE '%acne%' OR keyword LIKE '%skin care%' OR keyword LIKE '%skincare%'
          THEN 'Health: Dermatology'
        WHEN keyword LIKE '%rosacea%' THEN 'Health: Derm/Rosacea'
        WHEN keyword LIKE '%hyperpigmentation%' OR keyword LIKE '%melasma%'
          THEN 'Health: Derm/Hyperpigmentation'
        WHEN keyword LIKE '%hair loss%' OR keyword LIKE '%alopecia%'
          THEN 'Health: Derm/Hair Loss'
        -- Derm actives & hair-loss brands
        WHEN keyword LIKE '%retinol%' OR keyword LIKE '%tretinoin%' OR keyword LIKE '%niacinamide%' OR keyword LIKE '%hyaluronic acid%'
          THEN 'Health: Dermatology'
        WHEN keyword LIKE '%minoxidil%' OR keyword LIKE '%rogaine%' OR keyword LIKE '%finasteride%' OR keyword LIKE '%propecia%' OR keyword LIKE '%dht %' OR keyword LIKE '%blocker%'
          THEN 'Health: Derm/Hair Loss'
        WHEN keyword LIKE '%sciatica%' OR keyword LIKE '%back pain%' OR keyword LIKE '%knee pain%' OR keyword LIKE '%neuroma%'
          THEN 'Health: Musculoskeletal'
        WHEN keyword LIKE '%hip pain%' OR keyword LIKE '%hip replacement%'
          THEN 'Health: MSK/Hip'
        WHEN keyword LIKE '%arthritis%' OR keyword LIKE '%osteoarthritis%'
          THEN 'Health: MSK/Arthritis'
        WHEN keyword LIKE '%neuropathy%' OR keyword LIKE '%nerve pain%'
          THEN 'Health: MSK/Neuropathy'
        -- MSK brands & neuropathy agents
        WHEN keyword LIKE '%voltaren%' OR keyword LIKE '%diclofenac%' OR keyword LIKE '%biofreeze%' OR keyword LIKE '%aspercreme%'
          THEN 'Health: MSK/Arthritis'
        WHEN keyword LIKE '%gabapentin%' OR keyword LIKE '%pregabalin%' OR keyword LIKE '%lyrica%'
          THEN 'Health: MSK/Neuropathy'
        WHEN keyword LIKE '%asthma%' OR keyword LIKE '%copd%' OR keyword LIKE '%bronchitis%'
          THEN 'Health: Respiratory'
        WHEN keyword LIKE '%sinusitis%' OR keyword LIKE '%rhinitis%' OR keyword LIKE '%nasal spray%'
          THEN 'Health: Respiratory/Sinusitis'
        -- Respiratory decongestants & sprays
        WHEN keyword LIKE '%flonase%' OR keyword LIKE '%nasacort%' OR keyword LIKE '%oxymetazoline%' OR keyword LIKE '%afrin%' OR keyword LIKE '%sudafed%' OR keyword LIKE '%phenylephrine%' OR keyword LIKE '%mucinex%' OR keyword LIKE '%guaifenesin%'
          THEN 'Health: Respiratory/Sinusitis'
        WHEN keyword LIKE '%sleep apnea%' OR keyword LIKE '%cpap%'
          THEN 'Health: Sleep Apnea'
        WHEN keyword LIKE '%thyroid%' OR keyword LIKE '%hypothyroid%' OR keyword LIKE '%diabetes%'
          THEN 'Health: Endocrine'
        WHEN keyword LIKE '%prediabetes%' OR keyword LIKE '%a1c%'
          THEN 'Health: Endocrine/Prediabetes'
        WHEN keyword LIKE '%menopause%' OR keyword LIKE '%vaginal%' OR keyword LIKE '%gyno%'
          THEN 'Health: Gyn'
        WHEN keyword LIKE '%estradiol%' OR keyword LIKE '%hrt%' OR keyword LIKE '%hormone replacement%' OR keyword LIKE '%progesterone%'
          THEN 'Health: Gyn'
        -- Urology specifics
        WHEN keyword LIKE '%prostate%' OR keyword LIKE '%bph%'
          THEN 'Health: Urology'
        WHEN keyword LIKE '%tamsulosin%' OR keyword LIKE '%flomax%' OR keyword LIKE '%oxybutynin%' OR keyword LIKE '%ditropan%' OR keyword LIKE '%myrbetriq%' OR keyword LIKE '%gemtesa%'
          THEN 'Health: Urology'
        WHEN keyword LIKE '%dyslexia%' OR keyword LIKE '%neurolog%'
          THEN 'Health: Neuro'
        WHEN keyword LIKE '%migraine%'
          THEN 'Health: Neuro/Migraine'
        WHEN keyword LIKE '%vertigo%'
          THEN 'Health: Neuro/Vertigo'
        WHEN keyword LIKE '%tinnitus%'
          THEN 'Health: Neuro/Tinnitus'
        WHEN keyword LIKE '% vs %' OR keyword LIKE '% vs.%' THEN 'Health: OTC Comparisons'
        WHEN keyword LIKE '%supplement%' OR keyword LIKE '%vitamin%' OR keyword LIKE '%collagen%' OR keyword LIKE '%creatine%' OR keyword LIKE '%glutathione%'
          THEN 'Health: Supplements'
        -- Mental Health split
        WHEN keyword LIKE '%depression%' AND keyword LIKE '%anxiety%' THEN 'Depression + Anxiety'
        WHEN keyword LIKE '%depression%' THEN 'Depression'
        WHEN keyword LIKE '%anxiety%' THEN 'Anxiety'
        WHEN keyword LIKE '%substance%' OR keyword LIKE '%drug%' THEN 'Substance Abuse'
        ELSE 'Other'
      END AS angle
    FROM canon_metrics
  `);

  await exec(`
    CREATE VIEW canon_clustered_state AS
    SELECT
      state,
      keyword,
      searches,
      clicks,
      revenue,
      ctr,
      rpc,
      rps,
      CASE
        WHEN keyword LIKE '%loan%' OR keyword LIKE '%cash%' OR keyword LIKE '%payday%' THEN 'Loans / Cash'
        WHEN keyword LIKE '%clinical%' OR keyword LIKE '%trial%' OR keyword LIKE '%study%' THEN 'Clinical Trials'
        WHEN keyword LIKE '%depression%' OR keyword LIKE '%anxiety%' THEN 'Mental Health Trials'
        WHEN keyword LIKE '%erectile%' OR keyword LIKE '%ed%' THEN 'ED Trials'
        WHEN keyword LIKE '%medicare%' OR keyword LIKE '%flex card%' OR keyword LIKE '%giveback%' THEN 'Medicare Benefits'
        WHEN keyword LIKE '%adhd%' OR keyword LIKE '%prescription%' THEN 'Online Rx / ADHD'
        WHEN keyword LIKE '%casino%' OR keyword LIKE '%real money%' THEN 'Casino / Gambling'
        WHEN keyword LIKE '%insurance%' OR keyword LIKE '%bundle%' THEN 'Insurance'
        WHEN keyword LIKE '%checking bonus%' OR keyword LIKE '%open account%' THEN 'Bank Bonuses'
        WHEN keyword LIKE '%free phone%' OR keyword LIKE '%government cell%' THEN 'Free Phone / ACP'
        WHEN keyword LIKE '%dental implant%' THEN 'Dental Implants'
        WHEN keyword LIKE '%coolsculpt%' OR keyword LIKE '%belly fat%' OR keyword LIKE '%weight%'
          THEN 'Weight Loss / Body Contour'
        ELSE 'Other'
      END AS category
    FROM canon_metrics_state
  `);

  const outDir = getOutputDir();

  // Export helpers
  async function exportCSV(sql: string, outPath: string): Promise<void> {
    const rows = await all(sql);
    if (rows.length === 0) {
      fs.writeFileSync(outPath, '');
      return;
    }
    const keys = Object.keys(rows[0]);
    const lines = [keys.join(',')].concat(
      rows.map((r: any) => keys.map((k) => r[k] === null || r[k] === undefined ? '' : String(r[k])).join(','))
    );
    fs.writeFileSync(outPath, lines.join('\n'));
  }

  await exportCSV(
    `SELECT keyword, searches, clicks, revenue, ctr, rpc, rps
     FROM canon_metrics
     ORDER BY revenue DESC
     LIMIT 200`,
    path.join(outDir, 'top_by_revenue.csv')
  );

  await exportCSV(
    `SELECT keyword, searches, clicks, revenue, ctr, rpc, rps
     FROM canon_metrics
     WHERE clicks >= 50
     ORDER BY rpc DESC
     LIMIT 200`,
    path.join(outDir, 'top_by_rpc_min50clicks.csv')
  );

  await exportCSV(
    `SELECT keyword, searches, clicks, revenue, ctr, rpc, rps
     FROM canon_metrics
     WHERE searches >= 200
     ORDER BY rps DESC
     LIMIT 200`,
    path.join(outDir, 'top_by_rps_min200searches.csv')
  );

  await exportCSV(
    `SELECT category, SUM(searches) AS searches, SUM(clicks) AS clicks, SUM(revenue) AS revenue,
            CASE WHEN SUM(searches) > 0 THEN SUM(clicks) / SUM(searches) ELSE NULL END AS ctr,
            CASE WHEN SUM(clicks) > 0 THEN SUM(revenue) / SUM(clicks) ELSE NULL END AS rpc,
            CASE WHEN SUM(searches) > 0 THEN SUM(revenue) / SUM(searches) ELSE NULL END AS rps
     FROM canon_clustered
     GROUP BY 1
     ORDER BY revenue DESC`,
    path.join(outDir, 'clusters_summary.csv')
  );

  // Map high-level verticals from category (falls back when TOPIC_VERTICAL not in source)
  await exec(`
    CREATE VIEW category_vertical AS
    SELECT
      category,
      CASE
        WHEN category = 'Loans / Cash' THEN 'Finance: Loans'
        WHEN category = 'Insurance' THEN 'Finance: Insurance'
        WHEN category = 'Bank Bonuses' THEN 'Finance: Banking'
        WHEN category = 'Medicare Benefits' THEN 'Finance: Medicare'
        WHEN category = 'Clinical Trials' THEN 'Health: Clinical Trials'
        WHEN category = 'ED Trials' THEN 'Health: ED'
        WHEN category = 'Dental Implants' THEN 'Health: Dental'
        WHEN category = 'Online Rx / ADHD' THEN 'Health: Telehealth'
        WHEN category = 'Weight Loss / Body Contour' THEN 'Health: Weight Loss'
        WHEN category = 'Mental Health Trials' THEN 'Health: Mental Health'
        WHEN category = 'Free Phone / ACP' THEN 'Telecom: ACP'
        WHEN category = 'Casino / Gambling' THEN 'Entertainment: Gambling'
        ELSE 'Other'
      END AS vertical
    FROM (
      SELECT DISTINCT category FROM canon_clustered
    )
  `);

  // Vertical → Category index
  await exportCSV(
    `SELECT v.vertical,
            c.category,
            SUM(c.searches) AS searches,
            SUM(c.clicks) AS clicks,
            SUM(c.revenue) AS revenue,
            CASE WHEN SUM(searches) > 0 THEN SUM(clicks) / SUM(searches) ELSE NULL END AS ctr,
            CASE WHEN SUM(clicks) > 0 THEN SUM(revenue) / SUM(clicks) ELSE NULL END AS rpc,
            CASE WHEN SUM(searches) > 0 THEN SUM(revenue) / SUM(searches) ELSE NULL END AS rps
     FROM canon_clustered c
     JOIN category_vertical v USING(category)
     GROUP BY 1,2
     ORDER BY v.vertical, revenue DESC`,
    path.join(outDir, 'vertical_category_index.csv')
  );

  // Vertical → Angle (hook) index
  await exportCSV(
    `WITH joined AS (
       SELECT map.vertical,
              ca.keyword,
              ca.searches, ca.clicks, ca.revenue, ca.ctr, ca.rpc, ca.rps,
              CASE
                WHEN ca.keyword LIKE '%depression%' AND ca.keyword LIKE '%anxiety%' THEN 'Depression + Anxiety'
                WHEN ca.keyword LIKE '%depression%' THEN 'Depression'
                WHEN ca.keyword LIKE '%anxiety%' THEN 'Anxiety'
                WHEN ca.keyword LIKE '%substance%' OR ca.keyword LIKE '%drug%' THEN 'Substance Abuse'
                WHEN ca.keyword LIKE '%diabetes%' THEN 'Diabetes'
                WHEN ca.keyword LIKE '%back pain%' OR ca.keyword LIKE '%lower back%' THEN 'Back Pain'
                WHEN ca.keyword LIKE '%erectile%' OR ca.keyword LIKE '%ed %' OR ca.keyword LIKE 'ed %' THEN 'ED'
                WHEN ca.keyword LIKE '%dental implant%' THEN 'Dental Implants'
                WHEN ca.keyword LIKE '%coolsculpt%' OR ca.keyword LIKE '%belly fat%' OR ca.keyword LIKE '%weight%' THEN 'Weight Loss / Body Contour'
                WHEN ca.keyword LIKE '%adhd%' OR ca.keyword LIKE '%adderall%' THEN 'ADHD / Online Rx'
                WHEN ca.keyword LIKE '%insurance%' OR ca.keyword LIKE '%quote%' OR ca.keyword LIKE '%full coverage%' THEN 'Insurance Quotes'
                WHEN ca.keyword LIKE '%loan%' OR ca.keyword LIKE '%cash%' OR ca.keyword LIKE '%payday%' THEN 'Loans'
                WHEN ca.keyword LIKE '%casino%' OR ca.keyword LIKE '%real money%' THEN 'Casino / Real Money'
                WHEN ca.keyword LIKE '%medicare%' OR ca.keyword LIKE '%flex card%' OR ca.keyword LIKE '%giveback%' THEN 'Medicare Benefits'
                WHEN ca.keyword LIKE '%checking bonus%' OR ca.keyword LIKE '%open account%' THEN 'Bank Bonuses'
                WHEN ca.keyword LIKE '%free phone%' OR ca.keyword LIKE '%government cell%' THEN 'ACP / Free Phone'
                ELSE 'Other'
              END AS angle
       FROM canon_metrics ca
       JOIN (
         SELECT cc.keyword, cv.vertical
         FROM canon_clustered cc
         JOIN category_vertical cv USING(category)
       ) map USING(keyword)
     )
     SELECT vertical, angle,
            COUNT(*) AS num_phrases,
            SUM(searches) AS searches,
            SUM(clicks) AS clicks,
            SUM(revenue) AS revenue,
            CASE WHEN SUM(searches) > 0 THEN SUM(clicks) / SUM(searches) ELSE NULL END AS ctr,
            CASE WHEN SUM(clicks) > 0 THEN SUM(revenue) / SUM(clicks) ELSE NULL END AS rpc,
            CASE WHEN SUM(searches) > 0 THEN SUM(revenue) / SUM(searches) ELSE NULL END AS rps
     FROM joined
     GROUP BY 1,2
     ORDER BY vertical, revenue DESC`,
    path.join(outDir, 'vertical_angle_index.csv')
  );

  // Top hooks overall by revenue and by searches (scale)
  await exportCSV(
    `SELECT angle,
            COUNT(*) AS num_phrases,
            SUM(searches) AS searches,
            SUM(clicks) AS clicks,
            SUM(revenue) AS revenue,
            CASE WHEN SUM(clicks) > 0 THEN SUM(revenue) / SUM(clicks) ELSE NULL END AS rpc,
            CASE WHEN SUM(searches) > 0 THEN SUM(revenue) / SUM(searches) ELSE NULL END AS rps
     FROM (
       SELECT keyword,
         CASE
           WHEN keyword LIKE '%depression%' AND keyword LIKE '%anxiety%' THEN 'Depression + Anxiety'
           WHEN keyword LIKE '%depression%' THEN 'Depression'
           WHEN keyword LIKE '%anxiety%' THEN 'Anxiety'
           WHEN keyword LIKE '%substance%' OR keyword LIKE '%drug%' THEN 'Substance Abuse'
           WHEN keyword LIKE '%diabetes%' THEN 'Diabetes'
           WHEN keyword LIKE '%back pain%' OR keyword LIKE '%lower back%' THEN 'Back Pain'
           WHEN keyword LIKE '%erectile%' OR keyword LIKE '%ed %' OR keyword LIKE 'ed %' THEN 'ED'
           WHEN keyword LIKE '%dental implant%' THEN 'Dental Implants'
           WHEN keyword LIKE '%coolsculpt%' OR keyword LIKE '%belly fat%' OR keyword LIKE '%weight%' THEN 'Weight Loss / Body Contour'
           WHEN keyword LIKE '%adhd%' OR keyword LIKE '%adderall%' THEN 'ADHD / Online Rx'
           WHEN keyword LIKE '%insurance%' OR keyword LIKE '%quote%' OR keyword LIKE '%full coverage%' THEN 'Insurance Quotes'
           WHEN keyword LIKE '%loan%' OR keyword LIKE '%cash%' OR keyword LIKE '%payday%' THEN 'Loans'
           WHEN keyword LIKE '%casino%' OR keyword LIKE '%real money%' THEN 'Casino / Real Money'
           WHEN keyword LIKE '%medicare%' OR keyword LIKE '%flex card%' OR keyword LIKE '%giveback%' THEN 'Medicare Benefits'
           WHEN keyword LIKE '%checking bonus%' OR keyword LIKE '%open account%' THEN 'Bank Bonuses'
           WHEN keyword LIKE '%free phone%' OR keyword LIKE '%government cell%' THEN 'ACP / Free Phone'
           ELSE 'Other'
         END AS angle,
         searches, clicks, revenue
       FROM canon_metrics
     )
     GROUP BY 1
     ORDER BY revenue DESC`,
    path.join(outDir, 'top_hooks_by_revenue.csv')
  );

  await exportCSV(
    `SELECT angle,
            COUNT(*) AS num_phrases,
            SUM(searches) AS searches,
            SUM(clicks) AS clicks,
            SUM(revenue) AS revenue,
            CASE WHEN SUM(clicks) > 0 THEN SUM(revenue) / SUM(clicks) ELSE NULL END AS rpc,
            CASE WHEN SUM(searches) > 0 THEN SUM(revenue) / SUM(searches) ELSE NULL END AS rps
     FROM (
       SELECT keyword,
         CASE
           WHEN keyword LIKE '%depression%' AND keyword LIKE '%anxiety%' THEN 'Depression + Anxiety'
           WHEN keyword LIKE '%depression%' THEN 'Depression'
           WHEN keyword LIKE '%anxiety%' THEN 'Anxiety'
           WHEN keyword LIKE '%substance%' OR keyword LIKE '%drug%' THEN 'Substance Abuse'
           WHEN keyword LIKE '%diabetes%' THEN 'Diabetes'
           WHEN keyword LIKE '%back pain%' OR keyword LIKE '%lower back%' THEN 'Back Pain'
           WHEN keyword LIKE '%erectile%' OR keyword LIKE '%ed %' OR keyword LIKE 'ed %' THEN 'ED'
           WHEN keyword LIKE '%dental implant%' THEN 'Dental Implants'
           WHEN keyword LIKE '%coolsculpt%' OR keyword LIKE '%belly fat%' OR keyword LIKE '%weight%' THEN 'Weight Loss / Body Contour'
           WHEN keyword LIKE '%adhd%' OR keyword LIKE '%adderall%' THEN 'ADHD / Online Rx'
           WHEN keyword LIKE '%insurance%' OR keyword LIKE '%quote%' OR keyword LIKE '%full coverage%' THEN 'Insurance Quotes'
           WHEN keyword LIKE '%loan%' OR keyword LIKE '%cash%' OR keyword LIKE '%payday%' THEN 'Loans'
           WHEN keyword LIKE '%casino%' OR keyword LIKE '%real money%' THEN 'Casino / Real Money'
           WHEN keyword LIKE '%medicare%' OR keyword LIKE '%flex card%' OR keyword LIKE '%giveback%' THEN 'Medicare Benefits'
           WHEN keyword LIKE '%checking bonus%' OR keyword LIKE '%open account%' THEN 'Bank Bonuses'
           WHEN keyword LIKE '%free phone%' OR keyword LIKE '%government cell%' THEN 'ACP / Free Phone'
           ELSE 'Other'
         END AS angle,
         searches, clicks, revenue
       FROM canon_metrics
     )
     GROUP BY 1
     ORDER BY searches DESC`,
    path.join(outDir, 'top_hooks_by_searches.csv')
  );

  // Top "Other" phrases by revenue
  await exportCSV(
    `SELECT keyword, searches, clicks, revenue, ctr, rpc, rps
     FROM canon_angles
     WHERE angle = 'Other'
     ORDER BY revenue DESC
     LIMIT 200`,
    path.join(outDir, 'top_other_phrases_by_revenue.csv')
  );

  // RPC by state for selected themes (Ben's list)
  const toSafeSimple = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  const themeQueries: Array<{ name: string; where: string }> = [
    { name: 'Dental implant trials', where: "lower(keyword) LIKE '%dental implant%' AND (lower(keyword) LIKE '%trial%' OR lower(keyword) LIKE '%clinical%')" },
    { name: 'Nissan Rogue', where: "lower(keyword) LIKE '%nissan%' OR lower(keyword) LIKE '%rogue%'" },
    { name: 'Diabetes clinical trials', where: "lower(keyword) LIKE '%diabetes%' AND (lower(keyword) LIKE '%trial%' OR lower(keyword) LIKE '%clinical%')" },
    { name: 'Mississippi river cruise', where: "lower(keyword) LIKE '%mississippi%' AND lower(keyword) LIKE '%cruise%'" },
    { name: 'Jeep Grand Cherokee', where: "lower(keyword) LIKE '%jeep%' OR lower(keyword) LIKE '%cherokee%'" },
    { name: 'Home value', where: "lower(keyword) LIKE '%house worth%' OR lower(keyword) LIKE '%home value%' OR lower(keyword) LIKE '%property value%'" },
    { name: 'Senior living', where: "lower(keyword) LIKE '%senior living%' OR lower(keyword) LIKE '%memory care%' OR lower(keyword) LIKE '%independent living%'" },
    { name: 'Fat removal clinical trials', where: "(lower(keyword) LIKE '%fat removal%' OR lower(keyword) LIKE '%liposuction%' OR lower(keyword) LIKE '%coolsculpt%') AND (lower(keyword) LIKE '%trial%' OR lower(keyword) LIKE '%clinical%')" },
    { name: 'Botox', where: "lower(keyword) LIKE '%botox%'" },
  ];
  for (const q of themeQueries) {
    const safe = toSafeSimple(q.name);
    await exportCSV(
      `SELECT state,
              SUM(searches) AS searches,
              SUM(clicks)   AS clicks,
              SUM(revenue)  AS revenue,
              CASE WHEN SUM(clicks) > 0 THEN SUM(revenue) / SUM(clicks) ELSE NULL END AS rpc,
              CASE WHEN SUM(searches) > 0 THEN SUM(revenue) / SUM(searches) ELSE NULL END AS rps
       FROM canon_metrics_state
       WHERE ${q.where}
       GROUP BY 1
       ORDER BY rpc DESC NULLS LAST, revenue DESC`,
      path.join(outDir, `rpc_by_state_${safe}.csv`)
    );
  }

  // State-level volume and RPC/RPS by angle and vertical
  await exportCSV(
    `WITH angle_map AS (
       SELECT keyword,
         CASE
           WHEN keyword LIKE '%depression%' AND keyword LIKE '%anxiety%' THEN 'Depression + Anxiety'
           WHEN keyword LIKE '%depression%' THEN 'Depression'
           WHEN keyword LIKE '%anxiety%' THEN 'Anxiety'
           WHEN keyword LIKE '%substance%' OR keyword LIKE '%drug%' THEN 'Substance Abuse'
           WHEN keyword LIKE '%diabetes%' THEN 'Diabetes'
           WHEN keyword LIKE '%back pain%' OR keyword LIKE '%lower back%' THEN 'Back Pain'
           WHEN keyword LIKE '%erectile%' OR keyword LIKE '%ed %' OR keyword LIKE 'ed %' THEN 'ED'
           WHEN keyword LIKE '%dental implant%' THEN 'Dental Implants'
           WHEN keyword LIKE '%coolsculpt%' OR keyword LIKE '%belly fat%' OR keyword LIKE '%weight%' THEN 'Weight Loss / Body Contour'
           WHEN keyword LIKE '%adhd%' OR keyword LIKE '%adderall%' THEN 'ADHD / Online Rx'
           WHEN keyword LIKE '%insurance%' OR keyword LIKE '%quote%' OR keyword LIKE '%full coverage%' THEN 'Insurance Quotes'
           WHEN keyword LIKE '%loan%' OR keyword LIKE '%cash%' OR keyword LIKE '%payday%' THEN 'Loans'
           WHEN keyword LIKE '%casino%' OR keyword LIKE '%real money%' THEN 'Casino / Real Money'
           WHEN keyword LIKE '%medicare%' OR keyword LIKE '%flex card%' OR keyword LIKE '%giveback%' THEN 'Medicare Benefits'
           WHEN keyword LIKE '%checking bonus%' OR keyword LIKE '%open account%' THEN 'Bank Bonuses'
           WHEN keyword LIKE '%free phone%' OR keyword LIKE '%government cell%' THEN 'ACP / Free Phone'
           ELSE 'Other'
         END AS angle
       FROM canon_metrics
     ), cat_map AS (
       SELECT keyword, category FROM canon_clustered
     ), vert_map AS (
       SELECT category,
              CASE
                WHEN category = 'Loans / Cash' THEN 'Finance: Loans'
                WHEN category = 'Insurance' THEN 'Finance: Insurance'
                WHEN category = 'Bank Bonuses' THEN 'Finance: Banking'
                WHEN category = 'Medicare Benefits' THEN 'Finance: Medicare'
                WHEN category = 'Clinical Trials' THEN 'Health: Clinical Trials'
                WHEN category = 'ED Trials' THEN 'Health: ED'
                WHEN category = 'Dental Implants' THEN 'Health: Dental'
                WHEN category = 'Online Rx / ADHD' THEN 'Health: Telehealth'
                WHEN category = 'Weight Loss / Body Contour' THEN 'Health: Weight Loss'
                WHEN category = 'Mental Health Trials' THEN 'Health: Mental Health'
                WHEN category = 'Free Phone / ACP' THEN 'Telecom: ACP'
                WHEN category = 'Casino / Gambling' THEN 'Entertainment: Gambling'
                ELSE 'Other'
              END AS vertical
       FROM category_vertical
     )
     SELECT v.vertical, c.category, a.angle, s.state,
            SUM(s.searches) AS searches,
            SUM(s.clicks) AS clicks,
            SUM(s.revenue) AS revenue,
            CASE WHEN SUM(searches) > 0 THEN SUM(clicks) / SUM(searches) ELSE NULL END AS ctr,
            CASE WHEN SUM(clicks) > 0 THEN SUM(revenue) / SUM(clicks) ELSE NULL END AS rpc,
            CASE WHEN SUM(searches) > 0 THEN SUM(revenue) / SUM(searches) ELSE NULL END AS rps
     FROM canon_metrics_state s
     LEFT JOIN angle_map a USING(keyword)
     LEFT JOIN cat_map c USING(keyword)
     LEFT JOIN vert_map v USING(category)
     GROUP BY 1,2,3,4
     ORDER BY v.vertical, c.category, a.angle, revenue DESC`,
    path.join(outDir, 'vertical_angle_state_index.csv')
  );

  // Full set: every keyword with its category and metrics
  await exportCSV(
    `SELECT category, keyword, searches, clicks, revenue, ctr, rpc, rps
     FROM canon_clustered
     ORDER BY category, revenue DESC`,
    path.join(outDir, 'category_full.csv')
  );

  // Category index with counts and representative example (top revenue keyword per category)
  await exportCSV(
    `WITH agg AS (
        SELECT category,
               COUNT(*) AS num_phrases,
               SUM(searches) AS searches,
               SUM(clicks) AS clicks,
               SUM(revenue) AS revenue,
               CASE WHEN SUM(clicks) > 0 THEN SUM(revenue) / SUM(clicks) ELSE NULL END AS rpc,
               CASE WHEN SUM(searches) > 0 THEN SUM(revenue) / SUM(searches) ELSE NULL END AS rps
        FROM canon_clustered
        GROUP BY 1
      ),
      ranked AS (
        SELECT c.category,
               c.keyword,
               c.revenue,
               ROW_NUMBER() OVER (PARTITION BY c.category ORDER BY c.revenue DESC) AS rk
        FROM canon_clustered c
      )
     SELECT a.category,
            a.num_phrases,
            a.searches,
            a.clicks,
            a.revenue,
            a.rpc,
            a.rps,
            r.keyword AS example_keyword
     FROM agg a
     JOIN ranked r ON r.category = a.category AND r.rk = 1
     ORDER BY a.revenue DESC`,
    path.join(outDir, 'category_index.csv')
  );

  // Angle (subset) index with counts and representative example per category + angle
  await exportCSV(
    `WITH joined AS (
        SELECT
          CASE
            WHEN keyword LIKE '%loan%' OR keyword LIKE '%cash%' OR keyword LIKE '%payday%' THEN 'Loans / Cash'
            WHEN keyword LIKE '%clinical%' OR keyword LIKE '%trial%' OR keyword LIKE '%study%' THEN 'Clinical Trials'
            WHEN keyword LIKE '%depression%' OR keyword LIKE '%anxiety%' THEN 'Mental Health Trials'
            WHEN keyword LIKE '%erectile%' OR keyword LIKE '%ed%' THEN 'ED Trials'
            WHEN keyword LIKE '%medicare%' OR keyword LIKE '%flex card%' OR keyword LIKE '%giveback%' THEN 'Medicare Benefits'
            WHEN keyword LIKE '%adhd%' OR keyword LIKE '%prescription%' THEN 'Online Rx / ADHD'
            WHEN keyword LIKE '%casino%' OR keyword LIKE '%real money%' THEN 'Casino / Gambling'
            WHEN keyword LIKE '%insurance%' OR keyword LIKE '%bundle%' THEN 'Insurance'
            WHEN keyword LIKE '%checking bonus%' OR keyword LIKE '%open account%' THEN 'Bank Bonuses'
            WHEN keyword LIKE '%free phone%' OR keyword LIKE '%government cell%' THEN 'Free Phone / ACP'
            WHEN keyword LIKE '%dental implant%' THEN 'Dental Implants'
            WHEN keyword LIKE '%coolsculpt%' OR keyword LIKE '%belly fat%' OR keyword LIKE '%weight%'
              THEN 'Weight Loss / Body Contour'
            ELSE 'Other'
          END AS category,
          angle,
          keyword,
          searches,
          clicks,
          revenue
        FROM canon_angles
      ),
      agg AS (
        SELECT category, angle,
               COUNT(*) AS num_phrases,
               SUM(searches) AS searches,
               SUM(clicks) AS clicks,
               SUM(revenue) AS revenue,
               CASE WHEN SUM(clicks) > 0 THEN SUM(revenue) / SUM(clicks) ELSE NULL END AS rpc,
               CASE WHEN SUM(searches) > 0 THEN SUM(revenue) / SUM(searches) ELSE NULL END AS rps
        FROM joined
        GROUP BY 1,2
      ),
      ranked AS (
        SELECT category, angle, keyword, revenue,
               ROW_NUMBER() OVER (PARTITION BY category, angle ORDER BY revenue DESC) AS rk
        FROM joined
      )
     SELECT a.category, a.angle, a.num_phrases, a.searches, a.clicks, a.revenue, a.rpc, a.rps,
            r.keyword AS example_keyword
     FROM agg a
     JOIN ranked r ON r.category = a.category AND r.angle = a.angle AND r.rk = 1
     ORDER BY a.category, a.revenue DESC`,
    path.join(outDir, 'angle_index.csv')
  );

  // Full set: every keyword with category + angle
  await exportCSV(
    `WITH joined AS (
       SELECT
         CASE
           WHEN keyword LIKE '%loan%' OR keyword LIKE '%cash%' OR keyword LIKE '%payday%' THEN 'Loans / Cash'
           WHEN keyword LIKE '%clinical%' OR keyword LIKE '%trial%' OR keyword LIKE '%study%' THEN 'Clinical Trials'
           WHEN keyword LIKE '%depression%' OR keyword LIKE '%anxiety%' THEN 'Mental Health Trials'
           WHEN keyword LIKE '%erectile%' OR keyword LIKE '%ed%' THEN 'ED Trials'
           WHEN keyword LIKE '%medicare%' OR keyword LIKE '%flex card%' OR keyword LIKE '%giveback%' THEN 'Medicare Benefits'
           WHEN keyword LIKE '%adhd%' OR keyword LIKE '%prescription%' THEN 'Online Rx / ADHD'
           WHEN keyword LIKE '%casino%' OR keyword LIKE '%real money%' THEN 'Casino / Gambling'
           WHEN keyword LIKE '%insurance%' OR keyword LIKE '%bundle%' THEN 'Insurance'
           WHEN keyword LIKE '%checking bonus%' OR keyword LIKE '%open account%' THEN 'Bank Bonuses'
           WHEN keyword LIKE '%free phone%' OR keyword LIKE '%government cell%' THEN 'Free Phone / ACP'
           WHEN keyword LIKE '%dental implant%' THEN 'Dental Implants'
           WHEN keyword LIKE '%coolsculpt%' OR keyword LIKE '%belly fat%' OR keyword LIKE '%weight%'
             THEN 'Weight Loss / Body Contour'
           ELSE 'Other'
         END AS category,
         angle,
         keyword,
         searches,
         clicks,
         revenue,
         ctr,
         rpc,
         rps
       FROM canon_angles
     )
     SELECT category, angle, keyword, searches, clicks, revenue, ctr, rpc, rps
     FROM joined
     ORDER BY category, angle, revenue DESC`,
    path.join(outDir, 'angle_full.csv')
  );

  // Full set (state): every keyword with state, category and angle
  await exportCSV(
    `WITH base AS (
       SELECT cs.state,
              cs.keyword,
              cs.searches,
              cs.clicks,
              cs.revenue,
              cs.ctr,
              cs.rpc,
              cs.rps
       FROM canon_metrics_state cs
     ), cat AS (
       SELECT keyword,
         CASE
           WHEN keyword LIKE '%loan%' OR keyword LIKE '%cash%' OR keyword LIKE '%payday%' THEN 'Loans / Cash'
           WHEN keyword LIKE '%clinical%' OR keyword LIKE '%trial%' OR keyword LIKE '%study%' THEN 'Clinical Trials'
           WHEN keyword LIKE '%depression%' OR keyword LIKE '%anxiety%' THEN 'Mental Health Trials'
           WHEN keyword LIKE '%erectile%' OR keyword LIKE '%ed%' THEN 'ED Trials'
           WHEN keyword LIKE '%medicare%' OR keyword LIKE '%flex card%' OR keyword LIKE '%giveback%' THEN 'Medicare Benefits'
           WHEN keyword LIKE '%adhd%' OR keyword LIKE '%prescription%' THEN 'Online Rx / ADHD'
           WHEN keyword LIKE '%casino%' OR keyword LIKE '%real money%' THEN 'Casino / Gambling'
           WHEN keyword LIKE '%insurance%' OR keyword LIKE '%bundle%' THEN 'Insurance'
           WHEN keyword LIKE '%checking bonus%' OR keyword LIKE '%open account%' THEN 'Bank Bonuses'
           WHEN keyword LIKE '%free phone%' OR keyword LIKE '%government cell%' THEN 'Free Phone / ACP'
           WHEN keyword LIKE '%dental implant%' THEN 'Dental Implants'
           WHEN keyword LIKE '%coolsculpt%' OR keyword LIKE '%belly fat%' OR keyword LIKE '%weight%'
             THEN 'Weight Loss / Body Contour'
           ELSE 'Other'
         END AS category
       FROM canon_metrics
     ), ang AS (
       SELECT keyword,
         CASE
           WHEN keyword LIKE '%depression%' AND keyword LIKE '%anxiety%' THEN 'Depression + Anxiety'
           WHEN keyword LIKE '%depression%' THEN 'Depression'
           WHEN keyword LIKE '%anxiety%' THEN 'Anxiety'
           WHEN keyword LIKE '%substance%' OR keyword LIKE '%drug%' THEN 'Substance Abuse'
           WHEN keyword LIKE '%diabetes%' THEN 'Diabetes'
           WHEN keyword LIKE '%back pain%' OR keyword LIKE '%lower back%' THEN 'Back Pain'
           WHEN keyword LIKE '%erectile%' OR keyword LIKE '%ed %' OR keyword LIKE 'ed %' THEN 'ED'
           WHEN keyword LIKE '%dental implant%' THEN 'Dental Implants'
           WHEN keyword LIKE '%coolsculpt%' OR keyword LIKE '%belly fat%' OR keyword LIKE '%weight%' THEN 'Weight Loss / Body Contour'
           WHEN keyword LIKE '%adhd%' OR keyword LIKE '%adderall%' THEN 'ADHD / Online Rx'
           WHEN keyword LIKE '%insurance%' OR keyword LIKE '%quote%' OR keyword LIKE '%full coverage%' THEN 'Insurance Quotes'
           WHEN keyword LIKE '%loan%' OR keyword LIKE '%cash%' OR keyword LIKE '%payday%' THEN 'Loans'
           WHEN keyword LIKE '%casino%' OR keyword LIKE '%real money%' THEN 'Casino / Real Money'
           WHEN keyword LIKE '%medicare%' OR keyword LIKE '%flex card%' OR keyword LIKE '%giveback%' THEN 'Medicare Benefits'
           WHEN keyword LIKE '%checking bonus%' OR keyword LIKE '%open account%' THEN 'Bank Bonuses'
           WHEN keyword LIKE '%free phone%' OR keyword LIKE '%government cell%' THEN 'ACP / Free Phone'
           ELSE 'Other'
         END AS angle
       FROM canon_metrics
     )
     SELECT b.state, c.category, a.angle, b.keyword, b.searches, b.clicks, b.revenue, b.ctr, b.rpc, b.rps
     FROM base b
     LEFT JOIN cat c ON c.keyword = b.keyword
     LEFT JOIN ang a ON a.keyword = b.keyword
     ORDER BY c.category, a.angle, b.state, b.revenue DESC`,
    path.join(outDir, 'state_angle_full.csv')
  );

  await exportCSV(
    `SELECT state, category,
            SUM(searches) AS searches,
            SUM(clicks) AS clicks,
            SUM(revenue) AS revenue,
            CASE WHEN SUM(searches) > 0 THEN SUM(clicks) / SUM(searches) ELSE NULL END AS ctr,
            CASE WHEN SUM(clicks) > 0 THEN SUM(revenue) / SUM(clicks) ELSE NULL END AS rpc,
            CASE WHEN SUM(searches) > 0 THEN SUM(revenue) / SUM(searches) ELSE NULL END AS rps
     FROM canon_clustered_state
     GROUP BY 1,2
     ORDER BY category, rpc DESC`,
    path.join(outDir, 'state_clusters_summary.csv')
  );

  // Top states by RPC for Mental Health Trials (min 100 clicks for stability)
  await exportCSV(
    `SELECT state,
            SUM(searches) AS searches,
            SUM(clicks) AS clicks,
            SUM(revenue) AS revenue,
            CASE WHEN SUM(clicks) > 0 THEN SUM(revenue) / SUM(clicks) ELSE NULL END AS rpc,
            CASE WHEN SUM(searches) > 0 THEN SUM(revenue) / SUM(searches) ELSE NULL END AS rps
     FROM canon_clustered_state
     WHERE category = 'Mental Health Trials'
     GROUP BY 1
     HAVING SUM(clicks) >= 100
     ORDER BY rpc DESC
     LIMIT 100`,
    path.join(outDir, 'states_top_rpc_mental_health_trials.csv')
  );

  // Pattern: depression or anxiety across states
  await exportCSV(
    `SELECT state,
            SUM(searches) AS searches,
            SUM(clicks) AS clicks,
            SUM(revenue) AS revenue,
            CASE WHEN SUM(clicks) > 0 THEN SUM(revenue) / SUM(clicks) ELSE NULL END AS rpc,
            CASE WHEN SUM(searches) > 0 THEN SUM(revenue) / SUM(searches) ELSE NULL END AS rps
     FROM canon_metrics_state
     WHERE keyword LIKE '%depression%' OR keyword LIKE '%anxiety%'
     GROUP BY 1
     HAVING SUM(clicks) >= 50
     ORDER BY rpc DESC
     LIMIT 100`,
    path.join(outDir, 'states_top_rpc_depression_anxiety.csv')
  );

  await exportCSV(
    `SELECT category, keyword, searches, clicks, revenue, ctr, rpc, rps
     FROM canon_clustered
     WHERE category <> 'Other'
     ORDER BY category, revenue DESC
     LIMIT 1000`,
    path.join(outDir, 'clusters_top_keywords.csv')
  );

  const t: any = totals[0] || { searches: 0, clicks: 0, revenue: 0 };
  const summaryMd = `System1 Keyword Analysis\n\n` +
    `Input: ${inputPath}\n` +
    `Output: ${outDir}\n\n` +
    `Totals (keywords only, state totals removed):\n` +
    `- Searches: ${Math.round(t.searches || 0)}\n` +
    `- Clicks: ${Math.round(t.clicks || 0)}\n` +
    `- Revenue: ${t.revenue?.toFixed(2) || '0.00'}\n`;

  fs.writeFileSync(path.join(outDir, 'README.md'), summaryMd);
  console.log(summaryMd);

  // Content slug analysis (rank by revenue, then avg RPC)
  await exec(`
    CREATE VIEW content_slug_raw AS
    SELECT content_slug, row_label AS keyword, state, searches, clicks, revenue
    FROM with_state
    WHERE content_slug IS NOT NULL AND content_slug <> ''
  `);

  await exec(`
    CREATE VIEW content_slug_metrics AS
    SELECT
      content_slug,
      SUM(searches) AS searches,
      SUM(clicks) AS clicks,
      SUM(revenue) AS revenue,
      CASE WHEN SUM(clicks) > 0 THEN SUM(revenue) / SUM(clicks) ELSE NULL END AS rpc,
      CASE WHEN SUM(searches) > 0 THEN SUM(revenue) / SUM(searches) ELSE NULL END AS rps,
      COUNT(DISTINCT keyword) AS num_phrases,
      COUNT(*) AS row_count
    FROM content_slug_raw
    GROUP BY 1
  `);

  await exportCSV(
    `SELECT content_slug, num_phrases, row_count, searches, clicks, revenue, rpc, rps
     FROM content_slug_metrics
     ORDER BY revenue DESC, rpc DESC`,
    path.join(outDir, 'content_slug_ranked.csv')
  );

  // TODO: Clustering methodology removed - ready for new implementation
  // Previous clustering used Union-Find with keyword overlap, which created giant components
  // Consider: Jaccard similarity, hierarchical clustering, or community detection algorithms

  conn.close(() => {
    db.close(() => process.exit(0));
  });
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});


