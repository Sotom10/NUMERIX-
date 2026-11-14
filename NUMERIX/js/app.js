const CALCULADORA_DB_NAME = "calculadora_bd";
const CALCULADORA_DB_VERSION = 1;
const CALCULADORA_STORE_NAME = "registros";
let calculadoraDatabasePromise;
let historyRecords = [];

document.addEventListener("DOMContentLoaded", () => {
    document.querySelectorAll(".nav-button").forEach((button) => {
        button.addEventListener("click", () => {
            showModule(button.dataset.module);
            if (button.dataset.module === "historial") {
                loadHistoryRecords();
            }
        });
    });
    document.getElementById("history-results").addEventListener("click", (event) => {
        const exportButton = event.target.closest("[data-export-record]");
        if (exportButton) {
            exportHistoryRecord(exportButton.dataset.exportRecord);
        }
    });

    window.showModule = showModule;
    window.addPoint = addPoint;
    window.removePoint = removePoint;

    initializeTheme();
    document.getElementById("theme-toggle").addEventListener("click", toggleTheme);
    showModule("inicio");
    bindExistingPointActions();
    initializeDatabase();
});

function showModule(moduleName) {
    const sections = document.querySelectorAll(".module");
    sections.forEach((section) => {
        section.classList.toggle("active", section.id === moduleName);
    });

    const navButtons = document.querySelectorAll(".nav-button");
    navButtons.forEach((button) => {
        button.classList.toggle("active", button.dataset.module === moduleName);
    });

    const title = document.getElementById("page-title");
    if (!title) return;

    const titles = {
        inicio: "Inicio",
        lagrange: "Interpolación de Lagrange",
        "punto-fijo": "Iteración de punto fijo",
        historial: "Historial de cálculos"
    };

    title.textContent = titles[moduleName] || "Inicio";
}

function initializeTheme() {
    let theme = "dark";
    try {
        const savedTheme = localStorage.getItem("numerix-theme");
        if (savedTheme === "light" || savedTheme === "dark") {
            theme = savedTheme;
        }
    } catch (error) {
        console.error("No se pudo leer la preferencia del tema:", error);
    }

    setTheme(theme, false);
}

function toggleTheme() {
    const currentTheme = document.documentElement.dataset.theme || "dark";
    setTheme(currentTheme === "dark" ? "light" : "dark");
}

function setTheme(theme, persist = true) {
    document.documentElement.dataset.theme = theme;

    const button = document.getElementById("theme-toggle");
    const isDark = theme === "dark";
    button.setAttribute("aria-pressed", String(!isDark));
    button.setAttribute("aria-label", isDark ? "Cambiar a modo claro" : "Cambiar a modo oscuro");
    button.querySelector(".theme-label").textContent = isDark ? "Modo claro" : "Modo oscuro";
    button.querySelector("[aria-hidden='true']").textContent = isDark ? "☀" : "☾";

    if (persist) {
        try {
            localStorage.setItem("numerix-theme", theme);
        } catch (error) {
            console.error("No se pudo guardar la preferencia del tema:", error);
        }
    }

    if (typeof refreshChartsTheme === "function") {
        refreshChartsTheme();
    }
}

function initializeDatabase() {
    openCalculadoraDatabase()
        .then(() => {
            setDatabaseStatus("Historial local conectado");
            return loadHistoryRecords();
        })
        .catch((error) => {
            setDatabaseStatus(`Error de base de datos: ${error.message}`, true);
            renderHistoryError(error);
        });
}

function openCalculadoraDatabase() {
    if (calculadoraDatabasePromise) {
        return calculadoraDatabasePromise;
    }

    calculadoraDatabasePromise = new Promise((resolve, reject) => {
        if (!("indexedDB" in window)) {
            reject(new Error("Este navegador no permite almacenamiento IndexedDB."));
            return;
        }

        const request = indexedDB.open(CALCULADORA_DB_NAME, CALCULADORA_DB_VERSION);

        request.onupgradeneeded = () => {
            const database = request.result;
            if (!database.objectStoreNames.contains(CALCULADORA_STORE_NAME)) {
                database.createObjectStore(CALCULADORA_STORE_NAME, { keyPath: "id" });
            }
        };

        request.onsuccess = () => {
            const database = request.result;
            database.onversionchange = () => database.close();
            resolve(database);
        };

        request.onerror = () => {
            reject(request.error || new Error("No se pudo abrir la base de datos."));
        };

        request.onblocked = () => {
            reject(new Error("La actualización de la base de datos está bloqueada por otra pestaña."));
        };
    }).catch((error) => {
        calculadoraDatabasePromise = null;
        throw error;
    });

    return calculadoraDatabasePromise;
}

async function saveCalculationRecord(record) {
    try {
        const database = await openCalculadoraDatabase();
        await new Promise((resolve, reject) => {
            const transaction = database.transaction(CALCULADORA_STORE_NAME, "readwrite");
            transaction.objectStore(CALCULADORA_STORE_NAME).add(record);
            transaction.oncomplete = resolve;
            transaction.onerror = () => reject(transaction.error || new Error("No se pudo guardar el cálculo."));
            transaction.onabort = () => reject(transaction.error || new Error("El guardado del cálculo fue cancelado."));
        });

        setDatabaseStatus("Cálculo guardado en el historial");
        return loadHistoryRecords();
    } catch (error) {
        setDatabaseStatus(`No se pudo guardar: ${error.message}`, true);
        throw error;
    }
}

function createCalculationRecord(method, inputs, result) {
    const recordId = window.crypto && typeof window.crypto.randomUUID === "function"
        ? window.crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

    return {
        id: recordId,
        method,
        createdAt: new Date().toISOString(),
        inputs,
        result
    };
}

function reportRecordSaveError(containerId, error) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const warning = document.createElement("p");
    warning.className = "storage-warning";
    warning.setAttribute("role", "alert");
    warning.textContent = `El cálculo se realizó, pero no se pudo guardar en calculadora_bd: ${error.message}`;
    container.prepend(warning);
}

async function loadHistoryRecords() {
    const historyContainer = document.getElementById("history-results");
    if (!historyContainer) return;

    try {
        const database = await openCalculadoraDatabase();
        const records = await new Promise((resolve, reject) => {
            const transaction = database.transaction(CALCULADORA_STORE_NAME, "readonly");
            const request = transaction.objectStore(CALCULADORA_STORE_NAME).getAll();
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error || new Error("No se pudo consultar el historial."));
        });

        records.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        historyRecords = records;
        renderHistoryRecords(records);
    } catch (error) {
        setDatabaseStatus(`Error al leer el historial: ${error.message}`, true);
        renderHistoryError(error);
    }
}

function renderHistoryRecords(records) {
    const historyContainer = document.getElementById("history-results");
    historyContainer.replaceChildren();

    if (records.length === 0) {
        const emptyMessage = document.createElement("div");
        emptyMessage.className = "result-card";
        emptyMessage.textContent = "Todavía no hay cálculos guardados. Los resultados exitosos aparecerán aquí.";
        historyContainer.appendChild(emptyMessage);
        return;
    }

    records.forEach((record) => {
        const item = document.createElement("article");
        item.className = "history-item";

        const details = document.createElement("div");
        const title = document.createElement("h3");
        const description = document.createElement("p");
        const outcome = document.createElement("p");
        const timestamp = document.createElement("time");
        const actions = document.createElement("div");
        const exportButton = document.createElement("button");

        title.textContent = record.method === "lagrange"
            ? "Interpolación de Lagrange"
            : "Iteración de punto fijo";
        description.textContent = record.method === "lagrange"
            ? `Puntos: ${record.inputs.points.map(({ x, y }) => `(${x}, ${y})`).join(", ")} · x = ${record.inputs.evaluateX}`
            : `g(x) = ${record.inputs.expression} · x₀ = ${record.inputs.x0} · tolerancia = ${record.inputs.tolerance}`;
        outcome.textContent = record.method === "lagrange"
            ? `${record.result.polynomialText}; P(${record.inputs.evaluateX}) = ${record.result.value}`
            : `x ≈ ${record.result.root} · ${record.result.converged ? "Convergió" : "No convergió"} en ${record.result.iterationCount ?? record.result.iterations} iteraciones`;
        timestamp.dateTime = record.createdAt;
        timestamp.textContent = new Intl.DateTimeFormat("es", {
            dateStyle: "medium",
            timeStyle: "short"
        }).format(new Date(record.createdAt));
        actions.className = "history-actions";
        exportButton.type = "button";
        exportButton.className = "export-btn";
        exportButton.dataset.exportRecord = record.id;
        exportButton.textContent = "Exportar PDF";

        details.append(title, description, outcome);
        actions.append(timestamp, exportButton);
        item.append(details, actions);
        historyContainer.appendChild(item);
    });
}

function exportHistoryRecord(recordId) {
    const record = historyRecords.find(item => item.id === recordId);
    if (!record) {
        setDatabaseStatus("No se encontró el registro para exportar.", true);
        return;
    }

    const printWindow = window.open("", "_blank");
    if (!printWindow) {
        setDatabaseStatus("Permite las ventanas emergentes para exportar el PDF.", true);
        return;
    }

    const report = createPrintableReport(record);
    printWindow.document.open();
    printWindow.document.write(report);
    printWindow.document.close();
    window.setTimeout(() => {
        printWindow.focus();
        printWindow.print();
    }, 250);
}

function createPrintableReport(record) {
    const title = record.method === "lagrange"
        ? "Ejercicio de interpolación de Lagrange"
        : "Ejercicio de iteración de punto fijo";
    const createdAt = new Intl.DateTimeFormat("es", {
        dateStyle: "long",
        timeStyle: "short"
    }).format(new Date(record.createdAt));

    let exercise;
    if (record.method === "lagrange") {
        const pointsRows = record.inputs.points.map(({ x, y }) =>
            `<tr><td>${escapeHtml(x)}</td><td>${escapeHtml(y)}</td></tr>`
        ).join("");
        const basisRows = Array.isArray(record.result.bases)
            ? record.result.bases.map(basis => `
                <tr>
                    <td>L${escapeHtml(basis.index)}(x)</td>
                    <td>${escapeHtml(basis.expanded)}</td>
                    <td>${escapeHtml(basis.contribution)}</td>
                </tr>
            `).join("")
            : "";
        const basisTable = basisRows
            ? `<h2>Polinomios base y contribuciones</h2><table><thead><tr><th>Base</th><th>Forma desarrollada</th><th>Contribución</th></tr></thead><tbody>${basisRows}</tbody></table>`
            : "";
        exercise = `
            <h2>Datos de entrada</h2>
            <table><thead><tr><th>x</th><th>y</th></tr></thead><tbody>${pointsRows}</tbody></table>
            ${basisTable}
            <p><strong>Valor de evaluación:</strong> x = ${escapeHtml(record.inputs.evaluateX)}</p>
            <h2>Resultado</h2>
            <p><strong>Polinomio interpolador:</strong> ${escapeHtml(record.result.polynomialText)}</p>
            <p class="result">P(${escapeHtml(record.inputs.evaluateX)}) = ${escapeHtml(record.result.value)}</p>
        `;
    } else {
        const iterations = Array.isArray(record.result.iterations)
            ? record.result.iterations
            : [];
        const iterationRows = iterations.map(item => `
            <tr>
                <td>${escapeHtml(item.iteration)}</td>
                <td>${escapeHtml(item.currentX)}</td>
                <td>${escapeHtml(item.nextX)}</td>
                <td>${escapeHtml(item.error)}</td>
            </tr>
        `).join("");
        const iterationTable = iterations.length
            ? `<table><thead><tr><th>n</th><th>xₙ</th><th>xₙ₊₁</th><th>Error absoluto</th></tr></thead><tbody>${iterationRows}</tbody></table>`
            : "<p>Este registro antiguo no contiene el detalle de las iteraciones.</p>";
        exercise = `
            <h2>Datos de entrada</h2>
            <p><strong>g(x):</strong> ${escapeHtml(record.inputs.expression)}</p>
            <p><strong>Valor inicial:</strong> x₀ = ${escapeHtml(record.inputs.x0)}</p>
            <p><strong>Tolerancia:</strong> ${escapeHtml(record.inputs.tolerance)}</p>
            <p><strong>Máximo de iteraciones:</strong> ${escapeHtml(record.inputs.maxIterations)}</p>
            <h2>Tabla de iteraciones</h2>
            ${iterationTable}
            <h2>Resultado</h2>
            <p class="result">x ≈ ${escapeHtml(record.result.root)}</p>
            <p><strong>Estado:</strong> ${record.result.converged ? "Convergió" : "No convergió"}</p>
            <p><strong>Iteraciones realizadas:</strong> ${escapeHtml(record.result.iterationCount ?? iterations.length)}</p>
        `;
    }

    return `<!DOCTYPE html>
        <html lang="es">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <title>${escapeHtml(title)}</title>
            <style>
                body { font-family: Arial, sans-serif; color: #17223b; margin: 36px; line-height: 1.5; }
                h1 { color: #4338ca; border-bottom: 3px solid #38bdf8; padding-bottom: 12px; }
                h2 { margin-top: 26px; color: #334155; font-size: 17px; }
                table { width: 100%; border-collapse: collapse; margin: 14px 0; }
                th, td { padding: 9px; border: 1px solid #cbd5e1; text-align: left; }
                th { background: #eaf1ff; }
                .result { font-size: 20px; font-weight: bold; color: #047857; }
                .meta { color: #64748b; font-size: 12px; }
                @page { margin: 18mm; }
                @media print { body { margin: 0; } }
            </style>
        </head>
        <body>
            <h1>NUMERIX</h1>
            <p><strong>${escapeHtml(title)}</strong></p>
            <p class="meta">Generado: ${escapeHtml(createdAt)}</p>
            ${exercise}
        </body>
        </html>`;
}

function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, character => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        "\"": "&quot;",
        "'": "&#39;"
    })[character]);
}

function renderHistoryError(error) {
    const historyContainer = document.getElementById("history-results");
    if (!historyContainer) return;

    const message = document.createElement("div");
    message.className = "result-card error-text";
    message.textContent = `No se pudo cargar el historial: ${error.message}`;
    historyContainer.replaceChildren(message);
}

function setDatabaseStatus(message, isError = false) {
    const status = document.getElementById("database-status");
    if (!status) return;
    status.textContent = message;
    status.classList.toggle("status-error", isError);
}

function bindExistingPointActions() {
    document.querySelectorAll(".remove-btn").forEach((button) => {
        button.onclick = null;
        button.addEventListener("click", () => removePoint(button));
    });
}

function updatePointNumbers() {
    const rows = document.querySelectorAll("#points-body tr");
    rows.forEach((row, index) => {
        const numberCell = row.querySelector("td:first-child");
        if (numberCell) {
            numberCell.textContent = index + 1;
        }
    });
}

function addPoint(xValue = "", yValue = "") {
    const tableBody = document.getElementById("points-body");
    if (!tableBody) return;

    const row = document.createElement("tr");
    row.innerHTML = `
        <td>${tableBody.querySelectorAll("tr").length + 1}</td>
        <td><input type="number" step="any" class="point-x" value="${xValue}"></td>
        <td><input type="number" step="any" class="point-y" value="${yValue}"></td>
        <td><button class="remove-btn" type="button">×</button></td>
    `;

    const removeButton = row.querySelector(".remove-btn");
    removeButton.addEventListener("click", () => removePoint(removeButton));

    tableBody.appendChild(row);
}

function removePoint(button) {
    const row = button.closest("tr");
    const tableBody = document.getElementById("points-body");
    if (!row || !tableBody) return;

    const remainingRows = tableBody.querySelectorAll("tr");
    if (remainingRows.length <= 2) {
        return;
    }

    row.remove();
    updatePointNumbers();
}

window.saveCalculationRecord = saveCalculationRecord;
window.createCalculationRecord = createCalculationRecord;
window.reportRecordSaveError = reportRecordSaveError;
