
function calculateFixedPoint() {

    const expressionInput = document.getElementById("fixed-function");
    const x0Input = document.getElementById("fixed-x0");
    const toleranceInput = document.getElementById("fixed-tolerance");
    const maxIterationsInput = document.getElementById("fixed-iterations");

    if (!expressionInput || !x0Input || !toleranceInput || !maxIterationsInput) {
        return showFixedError("Faltan campos del módulo de punto fijo.");
    }

    const expression = expressionInput.value.trim();
    const x0Text = x0Input.value.trim();
    const toleranceText = toleranceInput.value.trim();
    const maxIterationsText = maxIterationsInput.value.trim();

    if (!expression) {
        return showFixedError("Ingresa una función g(x).");
    }

    if (!x0Text || !toleranceText || !maxIterationsText) {
        return showFixedError("Completa todos los campos numéricos.");
    }

    const x0 = Number(x0Text);
    const tolerance = Number(toleranceText);
    const maxIterations = Number(maxIterationsText);

    if (!Number.isFinite(x0) ||
        !Number.isFinite(tolerance) ||
        tolerance <= 0 ||
        !Number.isInteger(maxIterations) ||
        maxIterations < 1) {
        return showFixedError("Verifica los parámetros de entrada.");
    }

    let compiled;

    try {
        compiled = math.compile(expression);
    } catch (error) {
        return showFixedError("La expresión matemática no es válida.");
    }

    function evaluateFunction(x) {

        try {
            const value = compiled.evaluate({ x });

            if (typeof value !== "number" ||
                !Number.isFinite(value)) {
                throw new Error("Resultado no real o no finito.");
            }

            return value;

        } catch (error) {
            throw new Error("No se pudo evaluar g(x) en x = " + x);
        }
    }

    let currentX = x0;
    const iterations = [];

    let converged = false;
    let message = "";

    try {

        for (let i = 1; i <= maxIterations; i++) {

            const nextX = evaluateFunction(currentX);

            const error = Math.abs(nextX - currentX);

            iterations.push({
                iteration: i,
                currentX,
                nextX,
                error
            });

            if (error <= tolerance) {
                converged = true;
                currentX = nextX;
                break;
            }

            currentX = nextX;
        }

    } catch (error) {
        return showFixedError(error.message);
    }

    message = converged
        ? "El método alcanzó la tolerancia establecida."
        : "Se alcanzó el máximo de iteraciones sin cumplir la tolerancia.";

    const derivative = calculateDerivative(
        evaluateFunction,
        currentX
    );

    renderFixedResults({
        expression,
        iterations,
        root: currentX,
        converged,
        message,
        derivative
    });

    drawFixedPointGraph(evaluateFunction, currentX);
    const record = window.createCalculationRecord("punto-fijo", {
        expression,
        x0,
        tolerance,
        maxIterations
    }, {
        root: currentX,
        converged,
        iterations,
        iterationCount: iterations.length,
        derivative
    });

    window.saveCalculationRecord(record).catch(error => {
        window.reportRecordSaveError("fixed-results", error);
    });
}


// Derivada numérica para analizar la convergencia local
function calculateDerivative(fn, x) {

    const h = Math.sqrt(Number.EPSILON) * Math.max(1, Math.abs(x));

    try {
        return (fn(x + h) - fn(x - h)) / (2 * h);
    } catch {
        return NaN;
    }
}


// Mostrar tabla de iteraciones
function renderFixedResults(data) {
    const container = document.getElementById("fixed-results");
    const tableRows = data.iterations.map(item => `
        <tr><td>${item.iteration}</td><td>${formatNumber(item.currentX)}</td><td>${formatNumber(item.nextX)}</td><td>${formatNumber(item.error)}</td></tr>
    `).join("");
    const derivativeText = Number.isFinite(data.derivative) ? formatNumber(data.derivative) : "No disponible";
    const localCondition = Number.isFinite(data.derivative)
        ? Math.abs(data.derivative) < 1 ? "Cumple |g'(x)| < 1 aproximadamente." : "No cumple |g'(x)| < 1 aproximadamente."
        : "No se pudo estimar la derivada.";
    const functionTex = window.toMathTex(data.expression);
    const stateLabel = data.converged ? "CONVERGENCIA ALCANZADA" : "NO CONVERGIÓ";

    container.innerHTML = `
      <div class="results-heading"><span class="eyebrow">DESARROLLO DEL CÁLCULO</span><h2>Resultados de punto fijo</h2><p>Seguimiento de las aproximaciones hasta alcanzar la tolerancia o el límite establecido.</p></div>
      <div class="result-card result-highlight">
        <h3><span class="section-number">01</span> Función de iteración</h3>
        <div class="equation-main">\\[x_{n+1}=${functionTex}\\]</div>
        <div class="parameter-strip"><div><span>Valor inicial</span><strong>${formatNumber(data.iterations[0].currentX)}</strong></div><div><span>Tolerancia</span><strong>${document.getElementById('fixed-tolerance').value}</strong></div><div><span>Iteraciones</span><strong>${data.iterations.length}</strong></div></div>
      </div>
      <div class="result-card">
        <h3><span class="section-number">02</span> Tabla de iteraciones</h3>
        <p class="result-description">En cada paso se calcula x(n+1) = g(xn) y el error absoluto entre dos aproximaciones consecutivas.</p>
        <div class="table-container"><table class="data-table iteration-table"><thead><tr><th>Iteración (n)</th><th>Valor actual (x<sub>n</sub>)</th><th>Nuevo valor (x<sub>n+1</sub>)</th><th>Error absoluto</th></tr></thead><tbody>${tableRows}</tbody></table></div>
      </div>
      <div class="result-card result-answer-card">
        <div><h3><span class="section-number">03</span> Resultado final</h3><p class="result-description">${data.message}</p><span class="state-pill ${data.converged ? 'state-success' : 'state-warning'}">${stateLabel}</span></div>
        <div class="answer-metric"><span>Raíz aproximada</span><strong>${formatNumber(data.root)}</strong></div>
      </div>
      <div class="result-card">
        <h3><span class="section-number">04</span> Análisis de convergencia local</h3>
        <div class="equation-main compact-equation">\\[g'(x)\\approx ${derivativeText === 'No disponible' ? '\\text{No disponible}' : derivativeText}\\]</div>
        <p class="condition-message">${localCondition}</p>
        <small>La derivada se estima numéricamente cerca del resultado. Esta condición es un indicador local y no constituye una demostración general de convergencia.</small>
      </div>
      <div class="result-card"><h3><span class="section-number">05</span> Gráfica de punto fijo</h3><p class="result-description">La intersección entre y = g(x) y la recta y = x representa el punto fijo aproximado.</p><canvas id="fixed-chart"></canvas></div>
    `;
    window.renderMath?.(container);
}

function showFixedError(message) {

    document.getElementById("fixed-results").innerHTML = `
        <div class="result-card error-text">
            ${message}
        </div>
    `;
}
