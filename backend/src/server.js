require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');
const yahooFinance = require('yahoo-finance2').default; // Nova biblioteca importada

const app = express();
app.use(cors());
app.use(express.json());

// Validação das chaves do Supabase
if (!process.env.SUPABASE_URL || !process.env.SUPABASE_KEY) {
    console.error("❌ ERRO FATAL: Chaves do Supabase não encontradas no arquivo .env");
    process.exit(1);
}

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

// --- INTEGRAÇÃO COM YAHOO FINANCE (TEMPO REAL) ---
// Lista de ações da B3 (precisam ter o .SA no final para o Yahoo Finance)
const tickers = ['PETR4.SA', 'VALE3.SA', 'ITUB4.SA', 'WEGE3.SA', 'BBAS3.SA'];

// Armazena os dados em memória para o site consultar sem travar o servidor
let marketData = {};

// Função que busca os dados reais
async function updateMarketData() {
    try {
        // Busca as cotações no Yahoo Finance em lote
        const results = await yahooFinance.quote(tickers);
        
        const newData = {};
        for (const quote of results) {
            // Remove o ".SA" para o frontend mostrar apenas "PETR4", por exemplo
            const symbol = quote.symbol.replace('.SA', ''); 
            
            newData[symbol] = {
                name: quote.shortName || quote.longName || symbol,
                price: parseFloat(quote.regularMarketPrice.toFixed(2)),
                change: parseFloat(quote.regularMarketChangePercent.toFixed(2)) // Variação do dia em %
            };
        }
        
        marketData = newData; // Atualiza a variável global
        console.log(`📈 Mercado REAL atualizado: ${new Date().toLocaleTimeString()}`);
    } catch (error) {
        console.error("Erro ao buscar dados do Yahoo Finance:", error.message);
        // Em caso de erro, o site continua exibindo o último preço salvo na variável marketData
    }
}

// Busca os preços assim que o servidor liga
updateMarketData();

// Atualiza os preços automaticamente a cada 15 segundos
// (O Yahoo Finance atualiza os dados gratuitos a cada ~15 minutos na vida real, 
// mas buscar a cada 15 segundos garante que tenhamos o dado mais fresco possível)
setInterval(updateMarketData, 15000);

// --- ROTAS DA API ---

// 1. Obter preços atuais (O seu frontend chama essa rota)
app.get('/api/market', (req, res) => {
    // Se o mercado ainda estiver carregando a primeira vez, devolve um aviso
    if (Object.keys(marketData).length === 0) {
        return res.status(503).json({ error: "Carregando dados da bolsa..." });
    }
    res.json(marketData);
});

// 2. Comprar Ações
app.post('/api/trade/buy', async (req, res) => {
    const { userId, symbol, quantity } = req.body;
    const qty = parseInt(quantity);
    
    if (!marketData[symbol]) return res.status(400).json({ error: "Ação inválida ou dados indisponíveis" });
    if (qty <= 0) return res.status(400).json({ error: "Quantidade inválida" });

    const price = marketData[symbol].price;
    const totalCost = price * qty;

    try {
        // Checar saldo
        const { data: profile, error: profileErr } = await supabase
            .from('profiles')
            .select('balance')
            .eq('id', userId)
            .single();

        if (profileErr || !profile) return res.status(400).json({ error: "Usuário não encontrado" });
        if (profile.balance < totalCost) return res.status(400).json({ error: "Saldo insuficiente" });

        // Atualizar Saldo
        await supabase.from('profiles').update({ balance: profile.balance - totalCost }).eq('id', userId);

        // Atualizar Carteira (Upsert manual)
        const { data: portfolio } = await supabase.from('portfolio').select('*').eq('user_id', userId).eq('symbol', symbol).single();

        if (portfolio) {
            const newQty = portfolio.quantity + qty;
            const newAvgPrice = ((portfolio.average_price * portfolio.quantity) + totalCost) / newQty;
            await supabase.from('portfolio').update({ quantity: newQty, average_price: newAvgPrice }).eq('id', portfolio.id);
        } else {
            await supabase.from('portfolio').insert({ user_id: userId, symbol, quantity: qty, average_price: price });
        }

        res.json({ success: true, message: `Comprado ${qty}x ${symbol}`, newBalance: profile.balance - totalCost });
    } catch (err) {
        res.status(500).json({ error: "Erro interno no servidor" });
    }
});

// 3. Vender Ações
app.post('/api/trade/sell', async (req, res) => {
    const { userId, symbol, quantity } = req.body;
    const qty = parseInt(quantity);
    
    if (!marketData[symbol]) return res.status(400).json({ error: "Ação inválida ou dados indisponíveis" });
    if (qty <= 0) return res.status(400).json({ error: "Quantidade inválida" });

    const price = marketData[symbol].price;
    const totalValue = price * qty;

    try {
        // Checar se o usuário tem a ação
        const { data: portfolio } = await supabase.from('portfolio').select('*').eq('user_id', userId).eq('symbol', symbol).single();

        if (!portfolio || portfolio.quantity < qty) {
            return res.status(400).json({ error: "Você não possui essa quantidade de ações para vender" });
        }

        // Adicionar dinheiro ao saldo
        const { data: profile } = await supabase.from('profiles').select('balance').eq('id', userId).single();
        await supabase.from('profiles').update({ balance: profile.balance + totalValue }).eq('id', userId);

        // Atualizar Carteira
        if (portfolio.quantity === qty) {
            await supabase.from('portfolio').delete().eq('id', portfolio.id);
        } else {
            await supabase.from('portfolio').update({ quantity: portfolio.quantity - qty }).eq('id', portfolio.id);
        }

        res.json({ success: true, message: `Vendido ${qty}x ${symbol}`, newBalance: profile.balance + totalValue });
    } catch (err) {
        res.status(500).json({ error: "Erro interno no servidor" });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log("=========================================");
    console.log(`🚀 Servidor com Dados REAIS do Yahoo Finance ON!`);
    console.log(`🔗 Porta: ${PORT}`);
    console.log("=========================================");
});


