/**
 * Debug script to check if quote forms have "ad" in their class/ID names
 * This helps identify why lead gen forms might be counted as ads
 */

import { chromium, Browser } from 'playwright';

async function checkFormElements(url: string) {
  const browser = await chromium.launch({ headless: true });
  
  try {
    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    });
    const page = await context.newPage();
    
    await page.goto(url, { timeout: 30000, waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);
    
    const formInfo = await page.evaluate(() => {
      // @ts-ignore
      const doc = document;
      
      // Find all elements with "ad" in class or ID
      const adLikeElements: Array<{
        tag: string;
        className: string;
        id: string;
        text: string;
        isForm: boolean;
        isQuoteForm: boolean;
      }> = [];
      
      // Check all elements with "ad" in class
      const classAdElements = doc.querySelectorAll('[class*="ad"]');
      // @ts-ignore
      classAdElements.forEach((el: Element) => {
        const className = el.className || '';
        const id = el.id || '';
        const text = (el.textContent || '').substring(0, 100);
        const isForm = el.tagName === 'FORM' || el.querySelector('form') !== null || 
                      className.toLowerCase().includes('form') ||
                      text.toLowerCase().includes('quote') || 
                      text.toLowerCase().includes('zip');
        const isQuoteForm = text.toLowerCase().includes('quote') || 
                           text.toLowerCase().includes('get quote') ||
                           text.toLowerCase().includes('enter zip') ||
                           className.toLowerCase().includes('quote') ||
                           id.toLowerCase().includes('quote');
        
        adLikeElements.push({
          tag: el.tagName,
          className,
          id,
          text,
          isForm,
          isQuoteForm,
        });
      });
      
      // Check all elements with "ad" in ID
      const idAdElements = doc.querySelectorAll('[id*="ad"]');
      // @ts-ignore
      idAdElements.forEach((el: Element) => {
        // Skip if already found via class
        if (el.className && el.className.includes('ad')) return;
        
        const className = el.className || '';
        const id = el.id || '';
        const text = (el.textContent || '').substring(0, 100);
        const isForm = el.tagName === 'FORM' || el.querySelector('form') !== null || 
                      className.toLowerCase().includes('form') ||
                      text.toLowerCase().includes('quote') || 
                      text.toLowerCase().includes('zip');
        const isQuoteForm = text.toLowerCase().includes('quote') || 
                           text.toLowerCase().includes('get quote') ||
                           text.toLowerCase().includes('enter zip') ||
                           className.toLowerCase().includes('quote') ||
                           id.toLowerCase().includes('quote');
        
        adLikeElements.push({
          tag: el.tagName,
          className,
          id,
          text,
          isForm,
          isQuoteForm,
        });
      });
      
      // Also check all forms on the page
      const allForms: Array<{
        tag: string;
        className: string;
        id: string;
        text: string;
        hasAdInName: boolean;
      }> = [];
      
      const forms = doc.querySelectorAll('form, [class*="form"], [id*="form"]');
      // @ts-ignore
      forms.forEach((el: Element) => {
        const className = (el.className || '').toLowerCase();
        const id = (el.id || '').toLowerCase();
        const text = (el.textContent || '').substring(0, 100).toLowerCase();
        
        if (text.includes('quote') || text.includes('zip') || 
            className.includes('quote') || id.includes('quote')) {
          allForms.push({
            tag: el.tagName,
            className: el.className || '',
            id: el.id || '',
            text: (el.textContent || '').substring(0, 150),
            hasAdInName: className.includes('ad') || id.includes('ad'),
          });
        }
      });
      
      return {
        adLikeElements,
        quoteForms: allForms,
        totalAdLikeElements: adLikeElements.length,
        quoteFormsWithAdInName: allForms.filter(f => f.hasAdInName).length,
      };
    });
    
    await context.close();
    
    console.log('\n=== ELEMENTS WITH "AD" IN CLASS/ID ===');
    console.log(`Total found: ${formInfo.totalAdLikeElements}`);
    console.log('\nDetails:');
    formInfo.adLikeElements.forEach((el: any, idx: number) => {
      console.log(`\n${idx + 1}. ${el.tag}`);
      console.log(`   Class: ${el.className || '(none)'}`);
      console.log(`   ID: ${el.id || '(none)'}`);
      console.log(`   Text preview: ${el.text.substring(0, 80)}...`);
      console.log(`   Is Form: ${el.isForm}`);
      console.log(`   Is Quote Form: ${el.isQuoteForm}`);
    });
    
    console.log('\n=== QUOTE FORMS FOUND ===');
    console.log(`Total quote forms: ${formInfo.quoteForms.length}`);
    formInfo.quoteForms.forEach((form: any, idx: number) => {
      console.log(`\n${idx + 1}. ${form.tag}`);
      console.log(`   Class: ${form.className || '(none)'}`);
      console.log(`   ID: ${form.id || '(none)'}`);
      console.log(`   Has "ad" in name: ${form.hasAdInName ? '⚠️ YES' : '✅ NO'}`);
      console.log(`   Text preview: ${form.text.substring(0, 100)}...`);
    });
    
    return formInfo;
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

// Run if called directly
if (require.main === module) {
  const url = process.argv[2] || 'https://www.sunvalue.com/posts/15-mistakes-to-avoid-when-going-solar';
  checkFormElements(url)
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Error:', err);
      process.exit(1);
    });
}

export { checkFormElements };

