document.addEventListener('DOMContentLoaded', () => {
    // --- VERIFICAÇÃO DE AUTENTICAÇÃO ---
    const token = localStorage.getItem('shopping-list-token');
    if (!token) {
        window.location.href = '/login';
        return;
    }

    // --- Seletores ---
    const listNameH1 = document.getElementById('list-name');
    const listDateSpan = document.getElementById('list-date');
    const listTotalSpan = document.getElementById('list-total');
    const shoppingListUl = document.getElementById('shopping-list');
    const logoutButton = document.getElementById('logout-button');

    const API_URL = '/api';
    const authHeaders = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
    };

    // Pega o ID da lista da URL (ex: /list/5)
    const listId = window.location.pathname.split('/').pop();

    if (!listId) {
        alert('ID da lista não encontrado!');
        window.location.href = '/dashboard';
        return;
    }

    /**
     * Busca os dados da lista e seus itens
     */
    async function fetchListDetails() {
        try {
            // Usamos a rota get_items, que agora agrupa por categoria
            const response = await fetch(`${API_URL}/lists/${listId}/items`, { headers: authHeaders });

            if (!response.ok) {
                // Se a resposta não for OK (ex: 401, 404), desloga
                throw new Error('Não foi possível buscar os detalhes da lista.');
            }

            const data = await response.json();

            // Calcula o total geral (diferente dos totais da lista ativa)
            let totalGeral = 0;
            // Pega as categorias
            const categorias = Object.keys(data.items_agrupados).sort((a, b) => {
                if (a === "Outros") return 1;
                if (b === "Outros") return -1;
                return a.localeCompare(b);
            });

            listNameH1.textContent = data.list_name;
            // A data da lista não é enviada por esta API, então vamos omiti-la por agora
            // listDateSpan.textContent = `Data: (buscar...)`; 
            
            shoppingListUl.innerHTML = ''; // Limpa o "Carregando..."
            
            if (categorias.length === 0) {
                shoppingListUl.innerHTML = '<li>Esta lista não tinha itens.</li>';
            }

            // Para cada categoria, cria um cabeçalho e adiciona os itens
            categorias.forEach(categoria => {
                // 1. Cria o cabeçalho (ex: <h3>Hortifrúti</h3>)
                const categoryHeader = document.createElement('h3');
                categoryHeader.className = 'category-header';
                categoryHeader.textContent = categoria;
                shoppingListUl.appendChild(categoryHeader);

                // 2. Adiciona os itens (li)
                data.items_agrupados[categoria].forEach(item => {
                    const li = document.createElement('li');
                    li.className = 'list-item';
                    if (item.completed) {
                        li.classList.add('completed');
                    }
                    
                    const subtotal = (item.quantity * item.price);
                    totalGeral += subtotal; // Soma ao total geral
                    
                    // HTML "só de leitura" (sem botões de delete/checkbox)
                    li.innerHTML = `
                        <div class="item-details read-only">
                            <span class="status-icon">${item.completed ? '✅' : '❌'}</span>
                            <div class="item-text">
                                <strong>${item.name}</strong>
                                <span>${item.quantity} un. x R$ ${item.price.toFixed(2)} = R$ ${subtotal.toFixed(2)}</span>
                            </div>
                        </div>
                    `;
                    shoppingListUl.appendChild(li);
                });
            });

            // Atualiza o total geral
            listTotalSpan.textContent = `Total Gasto: R$ ${totalGeral.toFixed(2)}`;

        } catch (error) {
            console.error('Erro ao buscar detalhes da lista:', error);
            // Se der qualquer erro (token inválido, etc), desloga
            localStorage.removeItem('shopping-list-token');
            window.location.href = '/login';
        }
    }

    logoutButton.addEventListener('click', () => {
        localStorage.removeItem('shopping-list-token');
        window.location.href = '/login';
    });

    // --- Inicialização ---
    fetchListDetails();
});