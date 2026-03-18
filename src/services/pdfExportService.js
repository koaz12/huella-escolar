// src/services/pdfExportService.js
// Generates a styled PDF portfolio for a student using jspdf

import jsPDF from 'jspdf';

const PERF_COLORS = {
    logrado: [16, 185, 129],   // emerald
    proceso:  [245, 158, 11],  // amber
    apoyo:    [239, 68, 68],   // rose
};

const PERF_LABEL = { logrado: 'Logrado', proceso: 'Proceso', apoyo: 'Apoyo' };

/**
 * Convert an image URL to a base64 data URL (via canvas).
 */
async function urlToBase64(url) {
    try {
        const response = await fetch(url, { mode: 'cors' });
        const blob = await response.blob();
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    } catch {
        return null;
    }
}

/**
 * Export a student's evidence portfolio as a PDF.
 * @param {object} student  - { name, grade, section, listNumber }
 * @param {array}  evidences - array of evidence objects
 */
export async function exportStudentPDF(student, evidences) {
    const doc = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
    const W = 210;
    const MARGIN = 14;
    const CONTENT_W = W - MARGIN * 2;
    let y = 0;

    const addPage = () => {
        doc.addPage();
        y = MARGIN;
        drawHeader();
    };

    const checkPageBreak = (needed = 10) => {
        if (y + needed > 280) addPage();
    };

    // ── COVER HEADER ───────────────────────────────────────────
    const drawHeader = () => {
        doc.setFillColor(30, 58, 138); // blue-900
        doc.rect(0, 0, W, 22, 'F');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(13);
        doc.setTextColor(255, 255, 255);
        doc.text('Huella Escolar', MARGIN, 10);
        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');
        doc.text('Portafolio de Evidencias', MARGIN, 16);
        doc.setTextColor(0, 0, 0);
    };

    // ── PAGE 1: COVER ──────────────────────────────────────────
    drawHeader();
    y = 32;

    // Student card box
    doc.setFillColor(240, 249, 255);
    doc.roundedRect(MARGIN, y, CONTENT_W, 36, 4, 4, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.setTextColor(15, 23, 42);
    doc.text(student.name || 'Alumno', MARGIN + 6, y + 12);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(71, 85, 105);
    doc.text(`${student.grade || ''} ${student.section || ''} · N° ${student.listNumber || ''}`, MARGIN + 6, y + 20);

    const today = new Date().toLocaleDateString('es-DO', { year: 'numeric', month: 'long', day: 'numeric' });
    doc.text(`Emitido: ${today}`, MARGIN + 6, y + 28);
    y += 44;

    // Stats summary
    const total = evidences.length;
    const logrado = evidences.filter(e => e.performance === 'logrado').length;
    const proceso = evidences.filter(e => e.performance === 'proceso').length;
    const apoyo = evidences.filter(e => e.performance === 'apoyo').length;

    const stats = [
        { label: 'Total', value: total, color: [59, 130, 246] },
        { label: 'Logrado', value: logrado, color: PERF_COLORS.logrado },
        { label: 'Proceso', value: proceso, color: PERF_COLORS.proceso },
        { label: 'Apoyo', value: apoyo, color: PERF_COLORS.apoyo },
    ];

    const statW = CONTENT_W / stats.length;
    stats.forEach((stat, i) => {
        const sx = MARGIN + i * statW;
        doc.setFillColor(...stat.color);
        doc.roundedRect(sx + 2, y, statW - 4, 22, 3, 3, 'F');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(16);
        doc.setTextColor(255, 255, 255);
        doc.text(String(stat.value), sx + statW / 2, y + 11, { align: 'center' });
        doc.setFontSize(7);
        doc.setFont('helvetica', 'normal');
        doc.text(stat.label, sx + statW / 2, y + 18, { align: 'center' });
    });
    y += 30;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(15, 23, 42);
    doc.text('Historial de Evidencias', MARGIN, y);
    y += 6;
    doc.setDrawColor(226, 232, 240);
    doc.line(MARGIN, y, W - MARGIN, y);
    y += 6;

    // ── EVIDENCE CARDS (2 per row) ─────────────────────────────
    const CARD_W = (CONTENT_W - 6) / 2;
    const CARD_H = 54;
    const IMG_W = 32;
    const IMG_H = 32;

    for (let i = 0; i < evidences.length; i++) {
        const ev = evidences[i];
        const col = i % 2;
        const cx = MARGIN + col * (CARD_W + 6);

        if (col === 0) checkPageBreak(CARD_H + 6);

        // Card background
        doc.setFillColor(248, 250, 252);
        doc.setDrawColor(226, 232, 240);
        doc.roundedRect(cx, y, CARD_W, CARD_H, 3, 3, 'FD');

        let imgLoaded = false;
        // Only load images (not video)
        if (ev.fileUrl && ev.fileType !== 'video' && !ev.fileUrl?.includes('.mp4')) {
            const b64 = await urlToBase64(ev.fileUrl);
            if (b64) {
                try {
                    doc.addImage(b64, 'JPEG', cx + 3, y + 3, IMG_W, IMG_H, undefined, 'FAST');
                    imgLoaded = true;
                } catch {}
            }
        }

        if (!imgLoaded) {
            // Placeholder grey box
            doc.setFillColor(203, 213, 225);
            doc.rect(cx + 3, y + 3, IMG_W, IMG_H, 'F');
            doc.setFontSize(7);
            doc.setTextColor(100, 116, 139);
            doc.text('📹 Video', cx + 3 + IMG_W / 2, y + 3 + IMG_H / 2, { align: 'center' });
        }

        // Text section
        const tx = cx + IMG_W + 6;
        const tw = CARD_W - IMG_W - 9;

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        doc.setTextColor(15, 23, 42);
        const nameLines = doc.splitTextToSize(ev.activityName || 'Sin nombre', tw);
        doc.text(nameLines.slice(0, 2), tx, y + 9);

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7);
        doc.setTextColor(100, 116, 139);
        const date = ev.date ? new Date(ev.date).toLocaleDateString('es-DO') : '';
        doc.text(date, tx, y + 18);

        if (ev.performance && PERF_COLORS[ev.performance]) {
            const [r, g, b] = PERF_COLORS[ev.performance];
            doc.setFillColor(r, g, b);
            doc.roundedRect(tx, y + 21, 22, 5, 1.5, 1.5, 'F');
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(6);
            doc.setTextColor(255, 255, 255);
            doc.text(PERF_LABEL[ev.performance], tx + 11, y + 24.5, { align: 'center' });
        }

        if (ev.comment) {
            doc.setFont('helvetica', 'italic');
            doc.setFontSize(6.5);
            doc.setTextColor(71, 85, 105);
            const commentLines = doc.splitTextToSize(`"${ev.comment}"`, tw);
            doc.text(commentLines.slice(0, 2), tx, y + 30);
        }

        // Move to next row after 2nd card
        if (col === 1 || i === evidences.length - 1) {
            y += CARD_H + 4;
        }
    }

    // ── FOOTER on last page ────────────────────────────────────
    const pageCount = doc.getNumberOfPages();
    for (let p = 1; p <= pageCount; p++) {
        doc.setPage(p);
        doc.setFontSize(7);
        doc.setTextColor(148, 163, 184);
        doc.text(`Página ${p} de ${pageCount} · Generado por Huella Escolar`, W / 2, 290, { align: 'center' });
    }

    const safeName = (student.name || 'alumno').replace(/\s+/g, '_').toLowerCase();
    doc.save(`portafolio_${safeName}.pdf`);
}
