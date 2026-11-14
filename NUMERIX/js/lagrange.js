
function calculateLagrange() {

    const rows = document.querySelectorAll("#points-body tr");

    if (rows.length < 2) {
        return showLagrangeError("Ingresa al menos dos puntos.");
    }

    const hasEmptyInputs = Array.from(rows).some(row => {
        const xInput = row.querySelector(".point-x");
        const yInput = row.querySelector(".point-y");
        return !xInput || !yInput || !xInput.value.trim() || !yInput.value.trim();
    });

    if (hasEmptyInputs) {
        return showLagrangeError("Completa todos los campos de los puntos.");
    }

    const points = Array.from(rows).map(row => ({
        x: Number(row.querySelector(".point-x").value),
        y: Number(row.querySelector(".point-y").value)
    }));

    const evaluateInput = document.getElementById("lagrange-evaluate");
    if (!evaluateInput || !evaluateInput.value.trim()) {
        return showLagrangeError("Ingresa el valor x para evaluar el polinomio.");
    }

    const evaluateX = Number(evaluateInput.value);

    if (!Number.isFinite(evaluateX) ||
        points.some(p => !Number.isFinite(p.x) ||
                         !Number.isFinite(p.y))) {
        return showLagrangeError("Todos los valores deben ser números válidos.");
    }

    const xs = points.map(p => p.x);

    if (new Set(xs).size !== xs.length) {
        return showLagrangeError("Los valores X no pueden repetirse.");
    }

    // Polinomio representado mediante coeficientes:
    // [a0, a1, a2] representa a0 + a1*x + a2*x².

    let polynomial = [0];
    const bases = [];

    points.forEach((point, i) => {

        let basis = [1];
        let denominator = 1;
        const factors = [];

        points.forEach((other, j) => {

            if (i !== j) {

                basis = multiplyPolynomials(
                    basis,
                    [-other.x, 1]
                );

                denominator *= point.x - other.x;

                factors.push(
                    `(x - ${formatNumber(other.x)}) / ` +
                    `(${formatNumber(point.x - other.x)})`
                );
            }
        });

        const lagrangeBasis = basis.map(
            coefficient => coefficient / denominator
        );

        const contribution = lagrangeBasis.map(
            coefficient => coefficient * point.y
        );

        polynomial = addPolynomials(
            polynomial,
            contribution
        );

        bases.push({
            index: i,
            factors,
            polynomial: lagrangeBasis,
            contribution
        });
    });

    const result = evaluatePolynomial(polynomial, evaluateX);

    if (!Number.isFinite(result) || polynomial.some(coefficient => !Number.isFinite(coefficient))) {
        return showLagrangeError("El cálculo produjo un valor no finito. Revisa los datos ingresados.");
    }

    const polynomialText = polynomialToString(polynomial);

    renderLagrangeResults({
        points,
        bases,
        polynomial,
        polynomialText,
        evaluateX,
        result
    });

    drawLagrangeGraph(points, polynomial);
    const record = window.createCalculationRecord("lagrange", {
        points,
        evaluateX
    }, {
        polynomialText,
        value: result,
        bases: bases.map(basis => ({
            index: basis.index + 1,
            expanded: polynomialToString(basis.polynomial),
            contribution: polynomialToString(basis.contribution)
        }))
    });

    window.saveCalculationRecord(record).catch(error => {
        window.reportRecordSaveError("lagrange-results", error);
    });
}


// Multiplicación de polinomios
function multiplyPolynomials(a, b) {

    const result = Array(a.length + b.length - 1).fill(0);

    a.forEach((valueA, i) => {
        b.forEach((valueB, j) => {
            result[i + j] += valueA * valueB;
        });
    });

    return result;
}


// Suma de polinomios
function addPolynomials(a, b) {

    const length = Math.max(a.length, b.length);

    const result = Array(length).fill(0);

    for (let i = 0; i < length; i++) {
        result[i] = (a[i] || 0) + (b[i] || 0);
    }

    return result;
}


// Evaluación del polinomio usando Horner
function evaluatePolynomial(coefficients, x) {

    return coefficients
        .slice()
        .reverse()
        .reduce((result, coefficient) => result * x + coefficient, 0);
}


// Convertir polinomio a expresión legible
function polynomialToString(coefficients) {

    const terms = [];

    coefficients.forEach((coefficient, power) => {

        if (Math.abs(coefficient) < 1e-12) return;

        const sign = coefficient < 0 ? " - " : " + ";
        const abs = Math.abs(coefficient);

        let term = "";

        if (power === 0) {
            term = formatNumber(abs);
        } else {
            term = (Math.abs(abs - 1) < 1e-12 ? "" : formatNumber(abs))
                 + "x"
                 + (power > 1 ? `^${power}` : "");
        }

        terms.push({ sign, term });
    });

    if (!terms.length) return "P(x) = 0";

    return "P(x) = " + terms.map((item, i) =>
        (i === 0
            ? item.sign.trim() === "-" ? "-" : ""
            : item.sign) + item.term
    ).join("");
}


function formatNumber(value) {
    if (Math.abs(value) < 1e-12) return "0";
    return Number(value.toPrecision(10)).toString();
}


// Mostrar resultados y desarrollo
function renderLagrangeResults(data) {
    const container = document.getElementById("lagrange-results");
    const numberTex = value => Number(value).toPrecision(8).replace(/(?:\.0+|(?:(\.\d*?)0+))$/, '$1');
    const polynomialTex = coefficients => window.polynomialToTex(coefficients);

    const basisHTML = data.bases.map(basis => {
        const point = data.points[basis.index];
        const factors = data.points
            .filter((_, j) => j !== basis.index)
            .map(other => `\\frac{x-(${numberTex(other.x)})}{${numberTex(point.x - other.x)}}`)
            .join('\\,');
        return `
          <article class="math-step-card">
            <div class="math-step-heading"><span class="step-index">${basis.index + 1}</span><strong>Polinomio base L<sub>${basis.index}</sub>(x)</strong></div>
            <div class="equation-display">\\[L_{${basis.index}}(x)=${factors || '1'}\\]</div>
            <div class="equation-detail"><span>Forma desarrollada</span><div class="equation-display">\\[${polynomialTex(basis.polynomial)}\\]</div></div>
            <div class="equation-detail"><span>Contribución al polinomio</span><div class="equation-display">\\[${polynomialTex(basis.contribution)}\\]</div></div>
          </article>`;
    }).join("");

    container.innerHTML = `
      <div class="results-heading"><span class="eyebrow">DESARROLLO DEL CÁLCULO</span><h2>Resultados de interpolación</h2><p>Revisa cada etapa de la construcción del polinomio.</p></div>
      <div class="result-card">
        <h3><span class="section-number">01</span> Puntos ingresados</h3>
        <div class="table-container"><table class="data-table"><thead><tr><th>Punto</th><th>Coordenada x</th><th>Coordenada y</th></tr></thead><tbody>
          ${data.points.map((p, i) => `<tr><td>${i + 1}</td><td>${formatNumber(p.x)}</td><td>${formatNumber(p.y)}</td></tr>`).join("")}
        </tbody></table></div>
      </div>
      <div class="result-card">
        <h3><span class="section-number">02</span> Construcción de los polinomios base</h3>
        <p class="result-description">Se construye cada base utilizando los puntos restantes y se divide por el producto de las diferencias de sus coordenadas.</p>
        <div class="math-steps-grid">${basisHTML}</div>
      </div>
      <div class="result-card result-highlight">
        <h3><span class="section-number">03</span> Polinomio interpolador final</h3>
        <p class="result-description">La suma de las contribuciones genera el polinomio que pasa por todos los puntos ingresados.</p>
        <div class="equation-main">\\[P(x)=${polynomialTex(data.polynomial)}\\]</div>
      </div>
      <div class="result-card result-answer-card">
        <div><h3><span class="section-number">04</span> Evaluación del polinomio</h3><p class="result-description">Valor aproximado al evaluar el polinomio en x = ${formatNumber(data.evaluateX)}.</p></div>
        <div class="answer-metric"><span>Resultado P(${formatNumber(data.evaluateX)})</span><strong>${formatNumber(data.result)}</strong></div>
      </div>
      <div class="result-card"><h3><span class="section-number">05</span> Representación gráfica</h3><p class="result-description">Comparación visual del polinomio interpolador con los puntos suministrados.</p><canvas id="lagrange-chart"></canvas></div>
    `;
    window.renderMath?.(container);
}

function showLagrangeError(message) {

    document.getElementById("lagrange-results").innerHTML = `
        <div class="result-card error-text">
            ${message}
        </div>
    `;
}
