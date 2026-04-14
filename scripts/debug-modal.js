/**
 * Quick Debug: Copy and paste this ENTIRE CODE into Browser Console (F12)
 * Then press Enter and share the output
 */

(function () {
  var m = document.querySelector('.employee-modal');
  if (!m) {
    console.log('No modal found');
    return;
  }
  console.log('=== MODAL DEBUG ===');
  var rows = m.querySelectorAll('.data-row,.info-row');
  rows.forEach(function (r, i) {
    var s = r.querySelector('span'),
      l = r.querySelector('label');
    console.log(
      'Row ' +
        i +
        ': label=' +
        (l ? getComputedStyle(l).color : 'none') +
        ' span=' +
        (s ? getComputedStyle(s).color + ' op=' + getComputedStyle(s).opacity : 'none') +
        ' text="' +
        (s ? s.textContent.trim() : '') +
        '"',
    );
  });
  console.log(
    'Theme:',
    document.body.getAttribute('data-theme') || document.documentElement.getAttribute('data-theme'),
  );
})();
