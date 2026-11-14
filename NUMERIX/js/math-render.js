/* Presentación matemática de NUMERIX mediante MathJax 3. */
window.MathJax = {
  tex: { inlineMath: [['\\(', '\\)']], displayMath: [['\\[', '\\]']], processEscapes: true },
  options: { skipHtmlTags: ['script', 'noscript', 'style', 'textarea', 'pre', 'code'] },
  startup: { typeset: false }
};

window.renderMath = function (container) {
  if (!container || !window.MathJax?.typesetPromise) return;
  window.MathJax.typesetClear?.([container]);
  window.MathJax.typesetPromise([container]).catch(error => console.error('Error al representar ecuaciones:', error));
};

window.toMathTex = function (expression) {
  try { return math.parse(expression).toTex({parenthesis: 'keep'}); }
  catch { return String(expression).replace(/\\/g, '\\backslash ').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
};

window.polynomialToTex = function (coefficients, variable = 'x') {
  const terms = [];
  coefficients.forEach((coefficient, power) => {
    if (Math.abs(coefficient) < 1e-12) return;
    const abs = Math.abs(coefficient);
    let body = power === 0 ? Number(abs.toPrecision(8)).toString()
      : `${Math.abs(abs - 1) < 1e-12 ? '' : Number(abs.toPrecision(8)).toString()}${variable}${power > 1 ? `^{${power}}` : ''}`;
    if (!terms.length) terms.push(coefficient < 0 ? `-${body}` : body);
    else terms.push(`${coefficient < 0 ? '-' : '+'} ${body}`);
  });
  return terms.length ? terms.join(' ') : '0';
};
