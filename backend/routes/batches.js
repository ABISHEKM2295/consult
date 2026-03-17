const express = require('express');
const router = express.Router();
const Batch = require('../models/Batch');
const PDFDocument = require('pdfkit');
const Machine = require('../models/Machine');
const Inventory = require('../models/Inventory');

// Helper: Fast in-memory cost calculator for arrays of batches
const appendCosts = async (batchesList) => {
    try {
        const invItems = await Inventory.find({}, 'name costPerKg').lean();
        const machines = await Machine.find({}, 'name hourlyUtilityCost').lean();
        
        const invMap = {};
        invItems.forEach(i => invMap[i.name] = i.costPerKg || 0);
        
        const macMap = {};
        machines.forEach(m => macMap[m.name] = m.hourlyUtilityCost || 50);

        return batchesList.map(b => {
            let chm = 0, utl = 0;
            const items = [...(b.recipe?.dyes || []), ...(b.recipe?.chemicals || [])];
            for (const it of items) {
                if (!it.name || !it.qty) continue;
                const qtyMatch = String(it.qty).match(/([\d.]+)/);
                if (qtyMatch) chm += (parseFloat(qtyMatch[1]) * (invMap[it.name] || 0));
            }
            if (b.machine && b.duration) {
                let hrs = 0;
                const hM = String(b.duration).match(/(\d+)\s*(?:hours|h)/i);
                const mM = String(b.duration).match(/(\d+)\s*(?:mins|m|minutes)/i);
                if (hM) hrs += parseInt(hM[1]);
                if (mM) hrs += parseInt(mM[1]) / 60;
                if (!hrs) {
                   const jNum = String(b.duration).match(/^[\d.]+$/);
                   if (jNum) hrs = parseFloat(jNum[0]);
                }
                utl = hrs * (macMap[b.machine] || 50);
            }
            return {
                ...b,
                costs: {
                    chemicals: parseFloat(chm.toFixed(2)),
                    utilities: parseFloat(utl.toFixed(2)),
                    total: parseFloat((chm + utl).toFixed(2))
                }
            };
        });
    } catch(err) {
        console.error("Costs calc error", err);
        return batchesList;
    }
};

// GET all batches with optional filters
router.get('/', async (req, res) => {
    try {
        const { status, party, startDate, endDate } = req.query;
        let query = {};

        if (status) query.status = status;
        if (party) query.party = party;
        if (startDate || endDate) {
            query.date = {};
            if (startDate) query.date.$gte = startDate;
            if (endDate) query.date.$lte = endDate;
        }

        const batches = await Batch.find(query).sort({ createdAt: -1 }).lean();
        const batchesWithCosts = await appendCosts(batches);
        res.json(batchesWithCosts);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET batch statistics
router.get('/stats', async (req, res) => {
    try {
        const batches = await Batch.find();
        const completedBatches = batches.filter(b => b.status === 'completed');

        const stats = {
            total: batches.length,
            completed: completedBatches.length,
            rejected: batches.filter(b => b.status === 'rejected').length,
            inProgress: batches.filter(b => b.status === 'in-progress').length,
            avgEfficiency: completedBatches.length > 0
                ? Math.round(completedBatches.reduce((sum, b) => sum + b.efficiency, 0) / completedBatches.length)
                : 0,
            totalQuantity: batches.reduce((sum, b) => sum + parseFloat(b.quantity), 0)
        };

        res.json(stats);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ── Analytics (MUST be before /:id) ───────────────────────────
router.get('/analytics', async (req, res) => {
    try {
        const batches = await Batch.find({}).sort({ createdAt: 1 });

        // Monthly production (last 12 months)
        const monthlyMap = {};
        batches.forEach(b => {
            const d = b.createdAt || new Date();
            const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
            if (!monthlyMap[key]) monthlyMap[key] = { month: key, quantity: 0, count: 0, completed: 0, rejected: 0 };
            monthlyMap[key].quantity  += parseFloat(b.quantity) || 0;
            monthlyMap[key].count     += 1;
            if (b.status === 'completed') monthlyMap[key].completed += 1;
            if (b.status === 'rejected')  monthlyMap[key].rejected  += 1;
        });
        const monthly = Object.values(monthlyMap).slice(-12);

        // Top 5 colors by total kg
        const colorMap = {};
        batches.forEach(b => {
            const c = b.color || 'Unknown';
            colorMap[c] = (colorMap[c] || 0) + (parseFloat(b.quantity) || 0);
        });
        const topColors = Object.entries(colorMap)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([color, kg]) => ({ color, kg: parseFloat(kg.toFixed(1)) }));

        // Machine utilization hours
        const machineMap = {};
        batches.forEach(b => {
            const m = b.machine || 'Unknown';
            let hrs = 8;
            if (b.duration) {
                const hMatch = b.duration.match(/(\d+)h/);
                const mMatch = b.duration.match(/(\d+)m/);
                hrs = (hMatch ? parseInt(hMatch[1]) : 0) + (mMatch ? parseInt(mMatch[1]) / 60 : 0);
            }
            machineMap[m] = (machineMap[m] || 0) + hrs;
        });
        const machineUtilization = Object.entries(machineMap)
            .sort((a, b) => b[1] - a[1])
            .map(([machine, hours]) => ({ machine, hours: parseFloat(hours.toFixed(1)) }));

        // First-pass yield per month
        const fpy = monthly.map(m => ({
            month: m.month,
            yieldRate: m.count > 0 ? parseFloat(((m.completed / m.count) * 100).toFixed(1)) : 0,
        }));

        res.json({ monthly, topColors, machineUtilization, fpy });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET single batch by ID (Include Live Cost Calculation)
router.get('/:id', async (req, res) => {
    try {
        const batch = await Batch.findById(req.params.id).lean();
        if (!batch) {
            return res.status(404).json({ error: 'Batch not found' });
        }

        // --- Live Cost Calculation ---
        let totalChemicalCost = 0;
        let totalUtilityCost = 0;

        try {
            const Inventory = require('../models/Inventory');
            const Machine = require('../models/Machine');

            // 1. Calculate Chemical/Dye Costs
            const allItems = [...(batch.recipe?.dyes || []), ...(batch.recipe?.chemicals || [])];
            for (const item of allItems) {
                if (!item.name || !item.qty) continue;
                
                // Parse "2 kg" -> 2
                const qtyMatch = String(item.qty).match(/([\d.]+)/);
                const qtyNum = qtyMatch ? parseFloat(qtyMatch[1]) : 0;

                const invItem = await Inventory.findOne({ name: item.name });
                if (invItem && invItem.costPerKg) {
                    totalChemicalCost += (qtyNum * invItem.costPerKg);
                }
            }

            // 2. Calculate Machine Utility Costs
            if (batch.machine && batch.duration) {
                const machineRecord = await Machine.findOne({ name: batch.machine });
                const hourlyRate = machineRecord?.hourlyUtilityCost || 50; // default 50 if missing

                // Parse "6 hours", "6h 30m"
                let hours = 0;
                const hMatch = String(batch.duration).match(/(\d+)\s*(?:hours|h)/i);
                const mMatch = String(batch.duration).match(/(\d+)\s*(?:mins|m|minutes)/i);
                
                if (hMatch) hours += parseInt(hMatch[1]);
                if (mMatch) hours += parseInt(mMatch[1]) / 60;
                
                if (hours === 0 && hMatch === null) {
                   // Fallback for just a number e.g "6"
                   const justNum = String(batch.duration).match(/^[\d.]+$/);
                   if (justNum) hours = parseFloat(justNum[0]);
                }

                totalUtilityCost = hours * hourlyRate;
            }
        } catch (calcErr) {
            console.error("Cost calculation error:", calcErr);
            // Non-fatal, we just return 0 costs
        }

        batch.costs = {
            chemicals: parseFloat(totalChemicalCost.toFixed(2)),
            utilities: parseFloat(totalUtilityCost.toFixed(2)),
            total: parseFloat((totalChemicalCost + totalUtilityCost).toFixed(2))
        };

        res.json(batch);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// CREATE new batch
router.post('/', async (req, res) => {
    try {
        const batch = new Batch(req.body);
        await batch.save();

        // --- REAL-TIME: Update Machine Status ---
        if (batch.status === 'in-progress' && batch.machine) {
            await Machine.findOneAndUpdate(
                { name: batch.machine },
                { 
                    status: 'running',
                    party: batch.party || '',
                    color: batch.color || '',
                    lotNo: batch.lotNo || '',
                    quantity: String(batch.quantity || '')
                }
            );
        }

        res.status(201).json(batch);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// UPDATE batch
router.put('/:id', async (req, res) => {
    try {
        const oldBatch = await Batch.findById(req.params.id);
        if (!oldBatch) {
            return res.status(404).json({ error: 'Batch not found' });
        }

        const batch = await Batch.findByIdAndUpdate(
            req.params.id,
            req.body,
            { new: true, runValidators: true }
        );

        // --- REAL-TIME: Synchronize Machine & Inventory ---
        
        // 1. If transitioning TO 'in-progress'
        if (oldBatch.status !== 'in-progress' && batch.status === 'in-progress' && batch.machine) {
            await Machine.findOneAndUpdate(
                { name: batch.machine },
                { 
                    status: 'running',
                    party: batch.party || '',
                    color: batch.color || '',
                    lotNo: batch.lotNo || '',
                    quantity: String(batch.quantity || '')
                }
            );
        }

        // 2. If newly FINISHED (completed or rejected)
        const isFinishing = (batch.status === 'completed' || batch.status === 'rejected');
        const wasNotFinishing = (oldBatch.status !== 'completed' && oldBatch.status !== 'rejected');

        if (wasNotFinishing && isFinishing) {
            // Free the machine
            if (batch.machine) {
                await Machine.findOneAndUpdate(
                    { name: batch.machine },
                    { status: 'idle', party: '', color: '', lotNo: '', quantity: '' }
                );
            }

            // Deduct inventory used in the recipe
            const items = [...(batch.recipe?.dyes || []), ...(batch.recipe?.chemicals || [])];
            for (const item of items) {
                if (!item.name || !item.qty) continue;
                // Parse out the number, e.g. "2.5 kg" -> 2.5
                const qtyMatch = String(item.qty).match(/([\d.]+)/);
                const qtyNum = qtyMatch ? parseFloat(qtyMatch[1]) : 0;
                
                if (qtyNum > 0) {
                    const inv = await Inventory.findOne({ name: item.name });
                    if (inv) {
                        inv.stock = Math.max(0, parseFloat((inv.stock - qtyNum).toFixed(2)));
                        await inv.save(); // triggers pre-save hook for status update
                    }
                }
            }
        }

        res.json(batch);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// DELETE batch
router.delete('/:id', async (req, res) => {
    try {
        const batch = await Batch.findByIdAndDelete(req.params.id);
        if (!batch) {
            return res.status(404).json({ error: 'Batch not found' });
        }
        res.json({ message: 'Batch deleted successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});



// ── Quality Certificate PDF ────────────────────────────────────
router.get('/:id/certificate', async (req, res) => {
    try {
        const batch = await Batch.findById(req.params.id);
        if (!batch) return res.status(404).json({ error: 'Batch not found' });

        const doc = new PDFDocument({ margin: 60, size: 'A4' });
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="Certificate_${batch.batchId}.pdf"`);
        doc.pipe(res);

        // Border
        doc.rect(30,30,535,782).stroke('#1e3a5f');
        doc.rect(34,34,527,774).stroke('#c7d2e0');

        // Header bar
        doc.rect(30, 30, 535, 80).fill('#1e3a5f');
        doc.fillColor('#fff').fontSize(22).font('Helvetica-Bold')
           .text('PREMIER TEXTILE DYERS', 60, 50, { align: 'center' });
        doc.fontSize(12).font('Helvetica')
           .text('QUALITY CERTIFICATE', 60, 76, { align: 'center' });

        doc.fillColor('#000').moveDown(2);

        // Certificate title
        doc.fontSize(18).font('Helvetica-Bold').fillColor('#1e3a5f')
           .text('CERTIFICATE OF QUALITY', { align: 'center' });
        doc.moveDown(0.5);
        doc.fontSize(11).font('Helvetica').fillColor('#555')
           .text(`Certificate No: CERT-${batch.batchId}`, { align: 'center' });
        doc.text(`Date: ${new Date().toLocaleDateString('en-GB', { day:'2-digit', month:'long', year:'numeric' })}`, { align: 'center' });

        // Divider
        doc.moveDown();
        doc.moveTo(60, doc.y).lineTo(535, doc.y).stroke('#1e3a5f');
        doc.moveDown();

        // Batch Details Table
        doc.font('Helvetica-Bold').fontSize(12).fillColor('#1e3a5f').text('BATCH DETAILS');
        doc.moveDown(0.5);

        const fields = [
            ['Batch ID',    batch.batchId],
            ['Date',        batch.date],
            ['Party',       batch.party],
            ['Color',       batch.color],
            ['Lot Number',  batch.lotNo],
            ['Machine',     batch.machine],
            ['Quantity',    `${batch.quantity} kg`],
            ['Operator',    batch.operator],
            ['Status',      (batch.status || '').toUpperCase()],
            ['Efficiency',  `${batch.efficiency}%`],
            ['ΔE Result',   batch.deltaE != null ? batch.deltaE.toFixed(2) : '—'],
        ];

        fields.forEach(([label, val], i) => {
            const bg = i % 2 === 0 ? '#f8fafc' : '#fff';
            const y = doc.y;
            doc.rect(60, y, 450, 22).fill(bg);
            doc.font('Helvetica-Bold').fontSize(10).fillColor('#374151')
               .text(label, 68, y + 5, { width: 160, lineBreak: false });
            doc.font('Helvetica').fillColor('#1e293b')
               .text(String(val ?? '—'), 230, y + 5, { width: 270, lineBreak: false });
            doc.y = y + 22;
        });

        // Result
        doc.moveDown();
        const passed = (batch.deltaE == null || batch.deltaE <= 2.0) && batch.status === 'completed';
        doc.rect(60, doc.y, 450, 50).fill(passed ? '#f0fdf4' : '#fef2f2');
        doc.fontSize(16).font('Helvetica-Bold')
           .fillColor(passed ? '#10b981' : '#ef4444')
           .text(passed ? '✓  APPROVED FOR DISPATCH' : '✗  REQUIRES REVIEW', 60, doc.y + 13, { align: 'center', width: 450 });
        doc.y = doc.y + 50;

        // Signatures
        doc.moveDown(2);
        doc.font('Helvetica').fontSize(10).fillColor('#374151');
        const sigY = doc.y;
        doc.moveTo(80, sigY).lineTo(230, sigY).stroke('#000');
        doc.moveTo(365, sigY).lineTo(515, sigY).stroke('#000');
        doc.text('Quality Inspector', 80, sigY + 5, { width: 150, align: 'center' });
        doc.text('Production Manager', 365, sigY + 5, { width: 150, align: 'center' });

        // Footer
        doc.fontSize(9).fillColor('#9ca3af')
           .text('This certificate is computer generated by Premier Textile Dyers Management System.', 60, 770, { align: 'center' });

        doc.end();
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// PDF report generation
router.get('/report/pdf', async (req, res) => {
    try {
        const { status, party, startDate, endDate } = req.query;
        let query = {};
        if (status) query.status = status;
        if (party) query.party = party;
        if (startDate || endDate) {
            query.date = {};
            if (startDate) query.date.$gte = startDate;
            if (endDate) query.date.$lte = endDate;
        }

        const batchesRaw = await Batch.find(query).sort({ createdAt: -1 }).lean();
        const batches = await appendCosts(batchesRaw);
        const doc = new PDFDocument({ margin: 40, size: 'A4' });

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'attachment; filename="batch_report.pdf"');
        doc.pipe(res);

        // ── Header ──
        doc.fontSize(20).font('Helvetica-Bold')
           .text('Premier Textile Dyers', { align: 'center' });
        doc.fontSize(12).font('Helvetica')
           .text('Monthly Financial & Production Report', { align: 'center' });
        doc.fontSize(10).fillColor('#666')
           .text(`Generated: ${new Date().toLocaleString()}`, { align: 'center' });
        doc.moveDown();

        // ── Summary Analytics ──
        const completed  = batches.filter(b => b.status === 'completed').length;
        const rejected   = batches.filter(b => b.status === 'rejected').length;
        const inProgress = batches.filter(b => b.status === 'in-progress').length;
        const totalQty   = batches.reduce((s, b) => s + (parseFloat(b.quantity) || 0), 0);
        
        // Sum the analytical costs
        const totalChm = batches.reduce((s, b) => s + (b.costs?.chemicals || 0), 0);
        const totalUtl = batches.reduce((s, b) => s + (b.costs?.utilities || 0), 0);
        const grandTotal = totalChm + totalUtl;

        doc.fillColor('#000').fontSize(11).font('Helvetica-Bold').text('Summary Analysis');
        doc.font('Helvetica').fontSize(10)
           .text(`Production:  ${completed} Completed | ${inProgress} Active | ${rejected} Rejected`);
        doc.text(`Total Volume:  ${totalQty.toFixed(1)} kg`);
        doc.text(`Financials:    Chemicals $${totalChm.toFixed(2)} | Utilities $${totalUtl.toFixed(2)} | Total Cost $${grandTotal.toFixed(2)}`);
        doc.moveDown();

        // ── Table header ──
        const cols = { batchId: 55, date: 50, machine: 65, party: 65, color: 50, qty: 40, status: 60, cost: 55, deltaE: 30 };
        let y = doc.y;
        const rowH = 18;

        const drawRow = (row, isHeader = false) => {
            let x = 40;
            if (isHeader) { doc.rect(x, y, 515, rowH).fill('#1e3a5f'); }
            doc.font(isHeader ? 'Helvetica-Bold' : 'Helvetica')
               .fontSize(8)
               .fillColor(isHeader ? '#fff' : '#000');
            Object.entries(row).forEach(([key, val]) => {
                const w = cols[key] || 60;
                doc.text(String(val ?? '—'), x + 2, y + 4, { width: w - 4, lineBreak: false, ellipsis: true });
                x += w;
            });
            y += rowH;
            if (!isHeader) {
                doc.moveTo(40, y).lineTo(555, y).stroke('#e5e7eb');
            }
        };

        drawRow({ batchId: 'Batch ID', date: 'Date', machine: 'Machine', party: 'Party', color: 'Color', qty: 'Qty(kg)', status: 'Status', cost: 'Cost($)', deltaE: 'ΔE' }, true);

        batches.forEach((b, i) => {
            if (y > 760) { doc.addPage(); y = 40; drawRow({ batchId: 'Batch ID', date: 'Date', machine: 'Machine', party: 'Party', color: 'Color', qty: 'Qty(kg)', status: 'Status', cost: 'Cost($)', deltaE: 'ΔE' }, true); }
            if (i % 2 === 0) doc.rect(40, y, 515, rowH).fill('#f9fafb');
            drawRow({
                batchId:  b.batchId,
                date:     b.date,
                machine:  b.machine,
                party:    b.party,
                color:    b.color,
                qty:      (parseFloat(b.quantity) || 0).toFixed(1),
                status:   b.status,
                cost:     b.costs ? b.costs.total.toFixed(2) : '0.00',
                deltaE:   b.deltaE != null ? b.deltaE.toFixed(2) : '—',
            });
        });

        doc.end();
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
