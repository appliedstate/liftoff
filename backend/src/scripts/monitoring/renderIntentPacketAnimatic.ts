import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

type DeployPreview = {
  packet: {
    slug: string;
    packetName: string;
    article: {
      title: string;
      summary: string;
      widgetKeywordPhrases: string[];
    };
    ads: Array<{
      headline: string;
      primaryText: string;
      cta: string;
    }>;
  };
};

const DEFAULT_TRANSCRIPT =
  "Tired of overpaying for auto insurance? I just pulled up a quick comparison on my phone right here in my car. Took about two minutes. Found a bunch of options side by side - real rates, no runaround. Honestly wish I'd done this sooner. Worth checking before your next renewal.";

const DEFAULT_SCENES = [
  {
    title: 'Scene 1',
    body:
      "Driver in a parked car checks rates on a phone in daylight. Practical UGC tone. The hook is simple: comparison shopping without hype.",
  },
  {
    title: 'Scene 2',
    body:
      'Close-up of the phone showing clean quote cards and side-by-side options. The viewer sees a comparison moment, not a branded sales page.',
  },
  {
    title: 'Scene 3',
    body:
      'The driver relaxes after reviewing better options. Calm relief, small nod, and a clear path to learn more before renewal.',
  },
];

function parseArg(name: string): string | undefined {
  const prefix = `--${name}=`;
  return process.argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length);
}

function requireTool(tool: string): string {
  try {
    return execFileSync('which', [tool], { encoding: 'utf8' }).trim();
  } catch {
    throw new Error(`Required tool not found on PATH: ${tool}`);
  }
}

function run(cmd: string, args: string[]) {
  execFileSync(cmd, args, { stdio: 'inherit' });
}

function probeDuration(filePath: string): number {
  const output = execFileSync('ffprobe', [
    '-v',
    'error',
    '-show_entries',
    'format=duration',
    '-of',
    'default=noprint_wrappers=1:nokey=1',
    filePath,
  ], { encoding: 'utf8' }).trim();
  const duration = Number(output);
  if (!Number.isFinite(duration) || duration <= 0) {
    throw new Error(`Could not probe duration for ${filePath}`);
  }
  return duration;
}

function createSlide(
  outputPath: string,
  headline: string,
  body: string,
  footer: string,
) {
  const width = '1080';
  const height = '1920';
  run('magick', [
    '-size',
    `${width}x${height}`,
    'gradient:#0B132B-#1C2541',
    '-fill',
    '#5BC0BE',
    '-draw',
    'rectangle 0,0 1080,140',
    '-gravity',
    'NorthWest',
    '-fill',
    'white',
    '-font',
    'Helvetica-Bold',
    '-pointsize',
    '54',
    '-annotate',
    '+70+38',
    headline,
    '-gravity',
    'NorthWest',
    '(',
    '-background',
    'none',
    '-fill',
    '#F5F7FA',
    '-font',
    'Helvetica',
    '-pointsize',
    '42',
    '-size',
    '900x1100',
    `caption:${body}`,
    ')',
    '-geometry',
    '+90+290',
    '-composite',
    '-gravity',
    'SouthWest',
    '(',
    '-background',
    'none',
    '-fill',
    '#C9D6DF',
    '-font',
    'Helvetica',
    '-pointsize',
    '30',
    '-size',
    '900x220',
    `caption:${footer}`,
    ')',
    '-geometry',
    '+90+120',
    '-composite',
    outputPath,
  ]);
}

function createSegment(imagePath: string, outputPath: string, duration: number) {
  run('ffmpeg', [
    '-y',
    '-loop',
    '1',
    '-i',
    imagePath,
    '-t',
    duration.toFixed(2),
    '-r',
    '30',
    '-vf',
    'format=yuv420p',
    '-c:v',
    'libx264',
    '-pix_fmt',
    'yuv420p',
    outputPath,
  ]);
}

function main() {
  requireTool('ffmpeg');
  requireTool('ffprobe');
  requireTool('say');
  requireTool('convert');

  const previewPath =
    parseArg('preview') ||
    '/Users/ericroach/code/liftoff/backend/.local/strategis/facebook/intent-packet-deploy-preview/preview.json';
  const transcript = parseArg('transcript') || DEFAULT_TRANSCRIPT;

  const preview = JSON.parse(fs.readFileSync(previewPath, 'utf8')) as DeployPreview;
  const slug = preview.packet.slug;
  const outputDir = path.join(
    '/Users/ericroach/code/liftoff/backend/.local/strategis/facebook/intent-packet-video-test',
    slug,
  );

  fs.mkdirSync(outputDir, { recursive: true });

  const transcriptPath = path.join(outputDir, 'transcript.txt');
  fs.writeFileSync(transcriptPath, `${transcript}\n`);

  const metadataPath = path.join(outputDir, 'packet-metadata.json');
  fs.writeFileSync(
    metadataPath,
    JSON.stringify(
      {
        packetName: preview.packet.packetName,
        articleTitle: preview.packet.article.title,
        articleSummary: preview.packet.article.summary,
        widgetKeywords: preview.packet.article.widgetKeywordPhrases,
        ad: preview.packet.ads[0],
        transcript,
      },
      null,
      2,
    ),
  );

  const audioAiff = path.join(outputDir, 'voice.aiff');
  const audioM4a = path.join(outputDir, 'voice.m4a');
  run('say', [
    '-v',
    'Samantha',
    '-r',
    '185',
    '-o',
    audioAiff,
    transcript,
  ]);

  run('ffmpeg', [
    '-y',
    '-i',
    audioAiff,
    '-c:a',
    'aac',
    '-b:a',
    '192k',
    audioM4a,
  ]);

  const audioDuration = probeDuration(audioM4a);
  const sceneDuration = Math.max(4, audioDuration / DEFAULT_SCENES.length);
  const footer = `Widget keywords: ${preview.packet.article.widgetKeywordPhrases.join(' • ')}`;

  const segmentListPath = path.join(outputDir, 'segments.txt');
  const segmentPaths: string[] = [];

  DEFAULT_SCENES.forEach((scene, index) => {
    const slidePath = path.join(outputDir, `scene-${index + 1}.png`);
    const segmentPath = path.join(outputDir, `segment-${index + 1}.mp4`);
    createSlide(slidePath, scene.title, scene.body, footer);
    createSegment(slidePath, segmentPath, sceneDuration);
    segmentPaths.push(segmentPath);
  });

  fs.writeFileSync(
    segmentListPath,
    segmentPaths.map((segmentPath) => `file '${segmentPath.replace(/'/g, "'\\''")}'`).join('\n'),
  );

  const outputVideo = path.join(outputDir, 'intent-packet-animatic.mp4');
  run('ffmpeg', [
    '-y',
    '-f',
    'concat',
    '-safe',
    '0',
    '-i',
    segmentListPath,
    '-i',
    audioM4a,
    '-c:v',
    'libx264',
    '-pix_fmt',
    'yuv420p',
    '-c:a',
    'aac',
    '-shortest',
    outputVideo,
  ]);

  console.log(JSON.stringify({
    outputDir,
    outputVideo,
    transcriptPath,
    metadataPath,
    audioDuration,
    sceneDuration,
  }, null, 2));
}

main();
