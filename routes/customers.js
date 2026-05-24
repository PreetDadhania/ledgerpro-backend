const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const Customer = require('../models/Customer');
const Transaction = require('../models/Transaction');
const Payment = require('../models/Payment');
const auth = require('../middleware/auth');

function validate(req, res) {
  const e = validationResult(req);
  if (!e.isEmpty()) return res.status(400).json({ message: e.array()[0].msg });
  return null;
}

// GET /api/customers — list all with balances
router.get('/', auth, async (req, res) => {
  try {
    const customers = await Customer.find({ userId: req.user._id }).sort({ name: 1 });

    // Compute balance for each customer in parallel
    const data = await Promise.all(
      customers.map(async (c) => {
        const txns = await Transaction.find({ customerId: c._id });
        const pmts = await Payment.find({ customerId: c._id });
        const billed = txns.reduce((s, t) => s + (t.total || 0), 0);
        const paid   = pmts.reduce((s, p) => s + p.amount, 0);
        return {
          _id: c._id,
          name: c.name,
          mobile: c.mobile,
          createdAt: c.createdAt,
          balance: billed - paid,
          totalBilled: billed,
          totalPaid: paid,
        };
      })
    );

    res.json(data);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// POST /api/customers
router.post('/', auth, [
  body('name').trim().notEmpty().withMessage('Customer name is required'),
  body('mobile').optional().trim(),
], async (req, res) => {
  const e = validate(req, res); if (e) return;
  try {
    const customer = await Customer.create({
      userId: req.user._id,
      name: req.body.name,
      mobile: req.body.mobile || '',
    });
    res.status(201).json(customer);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// PUT /api/customers/:id
router.put('/:id', auth, [
  body('name').trim().notEmpty().withMessage('Customer name is required'),
], async (req, res) => {
  const e = validate(req, res); if (e) return;
  try {
    const customer = await Customer.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id },
      { name: req.body.name, mobile: req.body.mobile || '' },
      { new: true }
    );
    if (!customer) return res.status(404).json({ message: 'Customer not found' });
    res.json(customer);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// DELETE /api/customers/:id  (also deletes transactions + payments)
router.delete('/:id', auth, async (req, res) => {
  try {
    const customer = await Customer.findOneAndDelete({ _id: req.params.id, userId: req.user._id });
    if (!customer) return res.status(404).json({ message: 'Customer not found' });
    await Transaction.deleteMany({ customerId: req.params.id });
    await Payment.deleteMany({ customerId: req.params.id });
    res.json({ message: 'Customer deleted' });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /api/customers/:id/detail — full customer data
router.get('/:id/detail', auth, async (req, res) => {
  try {
    const customer = await Customer.findOne({ _id: req.params.id, userId: req.user._id });
    if (!customer) return res.status(404).json({ message: 'Customer not found' });

    const transactions = await Transaction.find({ customerId: customer._id }).sort({ date: -1, createdAt: -1 });
    const payments     = await Payment.find({ customerId: customer._id }).sort({ date: -1, createdAt: -1 });

    const totalBilled = transactions.reduce((s, t) => s + (t.total || 0), 0);
    const totalPaid   = payments.reduce((s, p) => s + p.amount, 0);

    res.json({
      customer,
      transactions,
      payments,
      summary: { totalBilled, totalPaid, outstanding: totalBilled - totalPaid },
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
