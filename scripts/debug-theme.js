/**
 * Extended Debug: Check theme state
 */
(function () {
  console.log('=== THEME CHECK ===');
  console.log('body data-theme:', document.body.getAttribute('data-theme'));
  console.log('html data-theme:', document.documentElement.getAttribute('data-theme'));

  var shell = document.querySelector('.main-app-shell');
  console.log(
    '.main-app-shell data-theme:',
    shell ? shell.getAttribute('data-theme') : 'NOT FOUND',
  );

  // Check dark mode toggle in CSS
  var modal = document.querySelector('.employee-modal');
  if (modal) {
    var bg = getComputedStyle(modal).backgroundColor;
    console.log('Modal background:', bg);
  }

  var col = document.querySelector('.info-column');
  if (col) {
    var colBg = getComputedStyle(col).backgroundColor;
    var colBorder = getComputedStyle(col).borderColor;
    console.log('Info column background:', colBg);
    console.log('Info column border:', colBorder);
  }
})();
