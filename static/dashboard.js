document.addEventListener('DOMContentLoaded', () => {
    const token = localStorage.getItem('shopping-list-token');
    if (!token) {
        window.location.href = '/login';
        return;
    }

    const savedListsUl = document.getElementById('saved-lists');
    const logoutButton = document.getElementById('logout-button');
    const API_URL = '/api';

    const authHeaders = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
    };

    /**
     * Busca e exibe as listas salvas (histórico)
     */
    async function fetchSavedLists() {
        try {
            const response = await fetch(`${API_URL}/dashboard`, { headers: authHeaders });
            if (!response.ok) {
                localStorage.removeItem('shopping-list-token');
                window.location.href = '/login';
                return;
            }

            const lists = await response.json();
            savedListsUl.innerHTML = ''; 

            if (lists.length === 0) {
                savedListsUl.innerHTML = '<li>Você ainda não tem listas salvas.</li>';
                return;
            }

            lists.forEach(list => {
                const li = document.createElement('li');
                li.className = 'saved-list-item';
                
                const formattedDate = new Date(list.created_date).toLocaleDateString('pt-BR', {
                    day: '2-digit', month: '2-digit', year: 'numeric'
                });

                // --- HTML ATUALIZADO (com botão de excluir) ---
                li.innerHTML = `
                    <a href="/list/${list.id}" class="saved-list-link">
                        <span class="saved-list-name">${list.name}</span>
                        <span class="saved-list-details">
                            Salva em: ${formattedDate}  |  Total: R$ ${list.total_price.toFixed(2)}
                        </span>
                    </a>
                    <button class="delete-list-btn" data-list-id="${list.id}">🗑️</button>
                `;
                savedListsUl.appendChild(li);
            });

        } catch (error) {
            console.error('Erro ao buscar listas salvas:', error);
            savedListsUl.innerHTML = '<li>Não foi possível carregar as listas.</li>';
        }
    }

    /**
     * --- NOVA FUNÇÃO PARA EXCLUIR LISTA ---
     */
    async function handleDeleteList(listId) {
        if (!confirm('Tem certeza que deseja excluir esta lista? Esta ação não pode ser desfeita.')) {
            return;
        }
        try {
            const response = await fetch(`${API_URL}/lists/${listId}`, {
                method: 'DELETE',
                headers: authHeaders
            });
            if (response.ok) {
                fetchSavedLists(); // Atualiza a lista
            } else {
                alert('Não foi possível excluir a lista.');
            }
        } catch (error) {
            console.error('Erro ao excluir lista:', error);
            alert('Erro de conexão ao tentar excluir.');
        }
    }

    logoutButton.addEventListener('click', () => {
        localStorage.removeItem('shopping-list-token');
        window.location.href = '/login';
    });

    // --- NOVO EVENT LISTENER PARA OS BOTÕES DE EXCLUIR ---
    savedListsUl.addEventListener('click', (event) => {
        if (event.target.classList.contains('delete-list-btn')) {
            const listId = event.target.dataset.listId;
            handleDeleteList(listId);
        }
    });

    fetchSavedLists();
});