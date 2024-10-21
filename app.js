var createError = require('http-errors');
var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');
var { Pool } = require('pg');
var cors = require('cors');

var indexRouter = require('./routes/index');
var usersRouter = require('./routes/users');

var app = express();
app.use(cors());

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

// Rota para adicionar ou sincronizar despesas (CRDT logic via POST)
app.post('/api/sync', async (req, res) => {
  const { expenses, timestamp } = req.body; // Esperamos um array de despesas e um timestamp

  if (!Array.isArray(expenses)) {
    return res.status(400).json({ error: 'O corpo da requisição deve conter um array de despesas' });
  }

  try {
    const results = [];
    for (const expense of expenses) {
      const { id, key, amount, user, date, timestamp } = expense;

      // Verifica se já existe a despesa no servidor
      const existingExpense = await pool.query('SELECT * FROM expenses WHERE id = $1', [id]);

      if (existingExpense.rows.length > 0) {
        const serverExpense = existingExpense.rows[0];

        // Verifica se o timestamp recebido é mais recente que o do servidor
        if (timestamp > serverExpense.timestamp) {
          // Atualiza o registro no banco de dados
          const updatedExpense = await pool.query(
              'UPDATE expenses SET descricao = $1, valor = $2, usuario = $3, data = $4, timestamp = $5 WHERE id = $6 RETURNING *',
              [key, amount, user || 'Desconhecido', date, timestamp, id]
          );
          results.push(updatedExpense.rows[0]);
        } else {
          // Se os dados do servidor forem mais recentes, mantém o dado do servidor
          results.push(serverExpense);
        }
      } else {
        // Insere o dado se não existir
        const newExpense = await pool.query(
            'INSERT INTO expenses(id, descricao, valor, usuario, data, timestamp) VALUES($1, $2, $3, $4, $5, $6) RETURNING *',
            [id, key, amount, user || 'Desconhecido', date, timestamp]
        );
        results.push(newExpense.rows[0]);
      }
    }

    res.status(201).json(results);  // Retorna todos os gastos sincronizados
  } catch (error) {
    console.error(error);
    res.status(500).send('Erro ao sincronizar dados');
  }
});

// Rota para buscar todas as despesas atualizadas desde o último timestamp
app.get('/api/sync', async (req, res) => {
  const lastSyncTimestamp = req.query.lastSyncTimestamp;

  try {
    // Busca todas as despesas que foram modificadas após o último timestamp do cliente
    const result = await pool.query(
        'SELECT * FROM expenses WHERE timestamp > $1',
        [lastSyncTimestamp]
    );
    res.json(result.rows);  // Retorna os gastos
  } catch (error) {
    console.error(error);
    res.status(500).send('Erro ao buscar dados sincronizados');
  }
});

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  next(createError(404));
});

// error handler
app.use(function(err, req, res, next) {
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};
  res.status(err.status || 500);
  res.render('error');
});


module.exports = app;
