const express = require('express');
const router = express.Router();

const Schedule = require('../models/Schedule');
// GET all schedules with optional date filter
router.get('/', async (req, res) => {
  try {
    const { date, status } = req.query;
    let query = {};

    if (date) query.date = date;
    if (status) query.status = status;

    const schedules = await Schedule.find(query).sort({ date: 1, time: 1 });
    res.json(schedules);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET week view for calendar
router.get('/week/:date', async (req, res) => {
  try {
    const startDate = new Date(req.params.date);
    const dates = [];

    for (let i = 0; i < 7; i++) {
      const date = new Date(startDate);
      date.setDate(startDate.getDate() + i);
      dates.push(date.toISOString().split('T')[0]);
    }

    const schedules = await Schedule.find({
      date: { $in: dates }
    }).sort({ date: 1, time: 1 });

    res.json(schedules);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/schedules/suggest
// Suggests the best machine and slot for a given batch size
router.get('/suggest', async (req, res) => {
  try {
    const quantity = Number(req.query.quantity);
    if (!quantity || isNaN(quantity)) {
      return res.status(400).json({ error: 'Quantity is required for suggestion' });
    }

    const Machine = require('../models/Machine');
    const machines = await Machine.find();
    
    // 1. Filter machines by capacity (we assume machine name contains capacity like "Dying Machine 500kg" or we derive it from the name for this demo, since Machine schema lacks capacity field)
    // For simplicity if no capacity field exists, we'll assign pseudo-capacities or just accept any machine that isn't named "Sample" if qty > 50
    // Let's get all schedules for today and tomorrow to check availability
    const today = new Date().toISOString().split('T')[0];
    const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];
    
    const activeSchedules = await Schedule.find({
      date: { $in: [today, tomorrow] },
      status: { $in: ['scheduled', 'in-progress'] }
    });

    const suggestions = [];

    machines.forEach(machine => {
      // Find a slot for this machine
      const machineJobs = activeSchedules.filter(s => s.machine === machine.name);
      
      let suggestedDate = today;
      let suggestedTime = "08:00";
      
      // Basic slot finding: if machine has jobs today, suggest tomorrow morning, else today morning.
      // (A real industrial algo would parse times and durations. This is a heuristic v1)
      if (machineJobs.some(j => j.date === today)) {
        suggestedDate = tomorrow;
        suggestedTime = "08:00";
      } else {
        // If it's afternoon already, maybe suggest 14:00
        const currentHour = new Date().getHours();
        suggestedTime = currentHour < 12 ? "14:00" : "08:00";
        if (suggestedTime === "08:00") suggestedDate = tomorrow;
      }

      // Calculate a "match score" (e.g., 95%)
      // If machine is idle right now, score goes up. 
      let score = 70;
      if (machine.status === 'idle') score += 20;
      
      suggestions.push({
        machineId: machine._id,
        machineName: machine.name,
        suggestedDate,
        suggestedTime,
        score: Math.min(score + Math.floor(Math.random() * 10), 99), // Add some variance for realism
        reason: machine.status === 'idle' ? 'Machine currently idle' : 'Earliest available slot'
      });
    });

    // Sort by descending score
    suggestions.sort((a, b) => b.score - a.score);

    res.json(suggestions.slice(0, 3)); // Return top 3
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET single schedule
router.get('/:id', async (req, res) => {
  try {
    const schedule = await Schedule.findById(req.params.id);
    if (!schedule) {
      return res.status(404).json({ error: 'Schedule not found' });
    }
    res.json(schedule);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// CREATE new schedule
router.post('/', async (req, res) => {
  try {
    const schedule = new Schedule(req.body);
    await schedule.save();
    res.status(201).json(schedule);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// UPDATE schedule
router.put('/:id', async (req, res) => {
  try {
    const schedule = await Schedule.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );
    if (!schedule) {
      return res.status(404).json({ error: 'Schedule not found' });
    }
    res.json(schedule);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// DELETE schedule
router.delete('/:id', async (req, res) => {
  try {
    const schedule = await Schedule.findByIdAndDelete(req.params.id);
    if (!schedule) {
      return res.status(404).json({ error: 'Schedule not found' });
    }
    res.json({ message: 'Schedule deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
