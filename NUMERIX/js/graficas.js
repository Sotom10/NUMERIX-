
let lagrangeChart = null;
let fixedChart = null;

function getChartTheme() {
    const styles = getComputedStyle(document.documentElement);
    return {
        text: styles.getPropertyValue("--chart-text").trim(),
        grid: styles.getPropertyValue("--chart-grid").trim()
    };
}

function refreshChartsTheme() {
    const theme = getChartTheme();

    [lagrangeChart, fixedChart].forEach(chart => {
        if (!chart) return;

        ["x", "y"].forEach(axis => {
            chart.options.scales[axis].ticks.color = theme.text;
            chart.options.scales[axis].grid.color = theme.grid;
            if (chart.options.scales[axis].title) {
                chart.options.scales[axis].title.color = theme.text;
            }
        });
        chart.options.plugins.legend.labels.color = theme.text;
        chart.update();
    });
}


// GRÁFICA DE LAGRANGE
function drawLagrangeGraph(points, coefficients) {

    const canvas = document.getElementById("lagrange-chart");
    if (!canvas) return;

    if (lagrangeChart) {
        lagrangeChart.destroy();
    }

    const minX = Math.min(...points.map(p => p.x));
    const maxX = Math.max(...points.map(p => p.x));

    const padding = Math.max((maxX - minX) * 0.15, 0.5);

    const start = minX - padding;
    const end = maxX + padding;

    const curve = [];
    const theme = getChartTheme();

    for (let i = 0; i <= 150; i++) {

        const x = start + (end - start) * i / 150;

        curve.push({
            x,
            y: evaluatePolynomial(coefficients, x)
        });
    }

    lagrangeChart = new Chart(canvas, {
        type: "scatter",
        data: {
            datasets: [
                {
                    label: "Polinomio interpolador",
                    data: curve,
                    showLine: true,
                    borderColor: "#38bdf8",
                    borderWidth: 2,
                    pointRadius: 0,
                    tension: 0
                },
                {
                    label: "Puntos originales",
                    data: points.map(p => ({
                        x: p.x,
                        y: p.y
                    })),
                    backgroundColor: "#34d399",
                    borderColor: "#34d399",
                    pointRadius: 6
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            scales: {
                x: {
                    type: "linear",
                    title: {
                        display: true,
                        text: "X",
                        color: theme.text
                    },
                    ticks: { color: theme.text },
                    grid: { color: theme.grid }
                },
                y: {
                    title: {
                        display: true,
                        text: "P(X)",
                        color: theme.text
                    },
                    ticks: { color: theme.text },
                    grid: { color: theme.grid }
                }
            },
            plugins: {
                legend: {
                    labels: { color: theme.text }
                }
            }
        }
    });
}


// GRÁFICA DE PUNTO FIJO
function drawFixedPointGraph(fn, root) {

    const canvas = document.getElementById("fixed-chart");
    if (!canvas) return;

    if (fixedChart) {
        fixedChart.destroy();
    }

    const range = Math.max(2, Math.abs(root) * 0.5);

    const start = root - range;
    const end = root + range;

    const functionData = [];
    const identityData = [];
    const theme = getChartTheme();

    for (let i = 0; i <= 150; i++) {

        const x = start + (end - start) * i / 150;

        try {
            const y = fn(x);

            if (Number.isFinite(y)) {
                functionData.push({ x, y });
            }
        } catch {
            // Se omiten los puntos donde la función no está definida.
        }

        identityData.push({
            x,
            y: x
        });
    }

    fixedChart = new Chart(canvas, {
        type: "scatter",
        data: {
            datasets: [
                {
                    label: "y = g(x)",
                    data: functionData,
                    showLine: true,
                    borderColor: "#38bdf8",
                    pointRadius: 0
                },
                {
                    label: "y = x",
                    data: identityData,
                    showLine: true,
                    borderColor: "#f59e0b",
                    pointRadius: 0
                },
                {
                    label: "Punto fijo aproximado",
                    data: [{ x: root, y: root }],
                    backgroundColor: "#34d399",
                    pointRadius: 6
                }
            ]
        },
        options: {
            responsive: true,
            scales: {
                x: {
                    type: "linear",
                    title: { display: true, text: "X", color: theme.text },
                    ticks: { color: theme.text },
                    grid: { color: theme.grid }
                },
                y: {
                    title: { display: true, text: "Y", color: theme.text },
                    ticks: { color: theme.text },
                    grid: { color: theme.grid }
                }
            },
            plugins: {
                legend: {
                    labels: { color: theme.text }
                }
            }
        }
    });
}
