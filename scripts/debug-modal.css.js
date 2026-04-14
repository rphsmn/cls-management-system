/**
 * Debug script for modal text visibility
 * Run this in browser console when the employee modal is open
 *
 * Usage: Open browser DevTools (F12) -> Console tab -> Paste this code
 */

(function () {
  console.clear();
  console.log('=== MODAL TEXT VISIBILITY DEBUG ===\n');

  // Check if modal exists
  const modal = document.querySelector('.employee-modal');
  if (!modal) {
    console.error('ERROR: No .employee-modal found on page');
    return;
  }

  // Get data rows
  const dataRows = modal.querySelectorAll('.data-row, .info-row');
  console.log(`Found ${dataRows.length} data rows in modal\n`);

  dataRows.forEach((row, index) => {
    const label = row.querySelector('label');
    const span = row.querySelector('span');

    console.log(`--- Row ${index + 1} ---`);
    console.log(`HTML: ${row.outerHTML.substring(0, 100)}...`);

    if (label) {
      const labelStyles = window.getComputedStyle(label);
      console.log(
        `LABEL computed: color=${labelStyles.color}, opacity=${labelStyles.opacity}, font-size=${labelStyles.fontSize}`,
      );
    }

    if (span) {
      const spanStyles = window.getComputedStyle(span);
      console.log(
        `SPAN computed: color=${spanStyles.color}, opacity=${spanStyles.opacity}, font-size=${spanStyles.fontSize}`,
      );
      console.log(`SPAN text content: "${span.textContent}"`);
    }
    console.log('');
  });

  // Check data-theme attribute
  const theme =
    document.body.getAttribute('data-theme') || document.documentElement.getAttribute('data-theme');
  console.log(`Current theme: ${theme}`);

  // Check for any overlay/opacity on container
  const infoColumn = modal.querySelector('.info-column');
  if (infoColumn) {
    const colStyles = window.getComputedStyle(infoColumn);
    console.log(
      `\nINFO COLUMN: background=${colStyles.backgroundColor}, opacity=${colStyles.opacity}`,
    );
  }

  // List all CSS rules affecting spans
  console.log('\n=== Checking for conflicting styles ===');
  const allSpans = modal.querySelectorAll('span');
  allSpans.forEach((span, i) => {
    if (span.textContent.trim() && i < 5) {
      const style = window.getComputedStyle(span);
      console.log(
        `Span ${i + 1}: "${span.textContent.substring(0, 30)}..." color:${style.color} opacity:${style.opacity}`,
      );
    }
  });

  console.log('\n=== DEBUG COMPLETE ===');
  console.log('Please copy this output and share it.');
})();
