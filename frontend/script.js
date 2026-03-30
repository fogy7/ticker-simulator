// frontend/script.js

// Substitua pelo ID de um usuário que você já tenha criado no Supabase para testar
const MEU_USER_ID = "COLE-AQUI-O-UUID-DO-USUARIO"; 

async function carregarDados() {
    try {
        // Busca Preços
        const resPrecos = await fetch('http://localhost:3000/api/precos');
        const acoes = await resPrecos.json();
        
        // Busca Saldo do Usuário
        const resSaldo = await fetch(`http://localhost:3000/api/saldo/${MEU_USER_ID}`);
        const perfil = await resSaldo.json();

        // Atualiza o HTML
        document.getElementById('balance').innerText = `R$ ${perfil.balance.toLocaleString('pt-BR')}`;
        document.getElementById('preco-petr4').innerText = `R$ ${acoes.PETR4.preco.toFixed(2)}`;
        
    } catch (error) {
        console.error("Erro ao carregar dados:", error);
    }
}

// Inicia tudo
carregarDados();