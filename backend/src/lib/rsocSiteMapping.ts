export function mapRsocSiteToS1GoogleAccount(rsocSite: string | null | undefined): string | null {
  if (!rsocSite) return null;
  const site = String(rsocSite).toLowerCase().trim();

  const siteToAccountMap: Record<string, string> = {
    'trusted-info': 'Zeus LLC',
    'wesoughtit.com': 'Zeus LLC',
    'read.travelroo.com': 'Sunday Market Media Inc',
    'topicwhich.com': 'Infospace Holdings',
    'eworld.tips': 'Huntley Media',
    'secretprice.com': 'Huntley Media',
    'trivia-library.com': 'Huntley Media',
    'searchalike.com': 'System1OpCo',
    'read.classroom67': '© 2025 read.Classroom67.com',
    'topicassist': 'System1OpCo',
    'dlg': 'System1OpCo',
  };

  return siteToAccountMap[site] || null;
}
