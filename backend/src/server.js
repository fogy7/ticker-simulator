// backend/src/server.js
require('dotenv').config(); // Lê o arquivo .env
const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');

const app = express();
app.use(cors());
app.use(express.json());

// Conexão com o Banco de Dados (Supabase)
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

// 1. Rota para pegar preços (Cache)
app.get('/api/precos', (req, res) => {
    const acoes = {
        "PETR4": { preco: 35.00 },
        "VALE3": { preco: 60.00 },
        "ITUB4": { preco: 30.00 }
    };
    res.json(acoes);
});

// 2. Rota para pegar o Saldo do Usuário
app.get('/api/saldo/:userId', async (req, res) => {
    const { userId } = req.params;
    const { data, error } = await supabase
        .from('profiles')
        .select('balance')
        .eq('id', userId)
        .single();

    if (error) return res.status(400).json(error);
    res.json(data);
});

const PORT = 3000;
app.listen(PORT, () => console.log(`✅ Servidor ON na porta ${PORT}`));