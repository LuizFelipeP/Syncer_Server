var express = require('express');
var router = express.Router();

// Array de exemplo para armazenar os gastos temporariamente
let expenses = [];

// Rota para adicionar um gasto
router.post('/gastos', (req, res) => {
  const { key, value } = req.body;
  expenses.push({ key, value });
  res.json({ message: 'Gasto adicionado com sucesso!' });
});

// Rota para remover um gasto
router.delete('/gastos', (req, res) => {
  const { key } = req.body;
  expenses = expenses.filter(expense => expense.key !== key);
  res.json({ message: 'Gasto removido com sucesso!' });
});

module.exports = router;
