var createError = require('http-errors');
var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');
var { Pool } = require('pg');
var cors = require('cors');  // ADICIONAR ESSA LINHA

var indexRouter = require('./routes/index');
var usersRouter = require('./routes/users');

var app = express();

app.use(cors());  // ADICIONAR ESSA LINHA

// Configuração do PostgreSQL
const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'Syncer',
  password: 'pimpa12345',
  port: 5432,
});

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'pug');

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

app.use('/api/', indexRouter);


const formatDate = (date) => {
  const options = {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  };
  return new Date(date).toLocaleString('pt-BR', options);  // Formata a data como DD/MM/YYYY HH:mm
};

// Nova rota para adicionar uma despesa
app.post('/api/add-expenses', async (req, res) => {
  const expenses = req.body.expenses;  // Esperamos um array chamado "expenses"

  if (!Array.isArray(expenses)) {
    return res.status(400).json({ error: 'O corpo da requisição deve conter um array de despesas' });
  }

  try {
    const results = [];
    for (const expense of expenses) {
      const { key: description, amount, user, date } = expense;

      // Insere cada gasto no banco de dados
      const result = await pool.query(
          'INSERT INTO expenses(description, amount, usuario, date) VALUES($1, $2, $3, $4) RETURNING *',
          [description, amount, user || 'Desconhecido', date]
      );
      // Formatar os dados e a data antes de enviá-los de volta
      const insertedExpense = result.rows[0];
      insertedExpense.date = formatDate(insertedExpense.date);
      insertedExpense.amount = `R$ ${parseFloat(insertedExpense.amount).toFixed(2)}`;
      insertedExpense.user = insertedExpense.usuario || 'Desconhecido';  // Tratamento para usuário nulo
      results.push(insertedExpense);
    }

    res.status(201).json(results);  // Retorna todos os gastos inseridos formatados
  } catch (error) {
    console.error(error);
    res.status(500).send('Erro ao inserir dados');
  }
});



// Rota para buscar todas as despesas
app.get('/api/expenses', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM expenses');

    const formattedExpenses = result.rows.map(expense => {
      return {
        ...expense,
        date: formatDate(expense.date),  // Formata a data
        amount: `R$ ${parseFloat(expense.amount).toFixed(2)}`,  // Formata o valor
        user: expense.usuario || 'Desconhecido'  // Substitui valores nulos por um padrão
      };
    });

    res.json(formattedExpenses);  // Retorna os gastos formatados
  } catch (error) {
    console.error(error);
    res.status(500).send('Erro ao buscar despesas');
  }
});



// catch 404 and forward to error handler
app.use(function(req, res, next) {
  next(createError(404));
});

// error handler
app.use(function(err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render('error');
});

module.exports = app;
