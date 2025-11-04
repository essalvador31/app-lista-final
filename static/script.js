document.addEventListener('DOMContentLoaded', () => {
    // --- VERIFICAÇÃO DE AUTENTICAÇÃO ---
    const token = localStorage.getItem('shopping-list-token');
    if (!token) {
        window.location.href = '/login';
        return;
    }

    // --- Seletores de Elementos HTML ---
    const listNameInput = document.getElementById('list-name-input');
    const nameInput = document.getElementById('item-name');
    const quantityInput = document.getElementById('item-quantity');
    const priceInput = document.getElementById('item-price');
    const categoryInput = document.getElementById('item-category');
    const addButton = document.getElementById('add-button');
    const shoppingListContainer = document.getElementById('shopping-list-container');
    const totalCompradoSpan = document.getElementById('total-comprado');
    const totalEstimativaSpan = document.getElementById('total-estimativa');
    const priceSuggestionSmall = document.getElementById('price-suggestion');
    const logoutButton = document.getElementById('logout-button');
    const finalizeButton = document.getElementById('finalize-button');

    const API_URL = 'http://127.0.0.1:5000/api';
    const authHeaders = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
    };

    let ACTIVE_LIST_ID = null;

    /**
     * --- ATUALIZAÇÃO 3: Função fetchItems reescrita para agrupar ---
     */
    async function fetchItems() {
        if (!ACTIVE_LIST_ID) {
            console.error("ID da lista ativa não encontrado!");
            return;
        }
        
        try {
            const response = await fetch(`${API_URL}/lists/${ACTIVE_LIST_ID}/items`, { headers: authHeaders });
            if (!response.ok) throw new Error('Falha na autenticação');
            
            const data = await response.json();
            shoppingListContainer.innerHTML = ''; // Limpa o container
            
            listNameInput.value = data.list_name; 

            const categorias = Object.keys(data.items_agrupados).sort((a, b) => {
                if (a === "Outros") return 1;
                if (b === "Outros") return -1;
                return a.localeCompare(b);
            });

            if (categorias.length === 0) {
                shoppingListContainer.innerHTML = '<p class="empty-list-message">Sua lista está vazia.</p>';
            }

            categorias.forEach(categoria => {
                const categoryHeader = document.createElement('h3');
                categoryHeader.className = 'category-header';
                categoryHeader.textContent = categoria;
                shoppingListContainer.appendChild(categoryHeader);

                const categoryList = document.createElement('ul');
                categoryList.className = 'shopping-list';
                
                data.items_agrupados[categoria].forEach(item => {
                    const li = document.createElement('li');
                    li.className = 'list-item';
                    li.dataset.id = item.id;
                    
                    li.dataset.name = item.name;
                    li.dataset.quantity = item.quantity;
                    li.dataset.price = item.price;
                    li.dataset.completed = item.completed;
                    li.dataset.category = item.category;
                    
                    li.innerHTML = createItemViewHtml(item);
                    
                    if (item.completed) {
                        li.classList.add('completed');
                    }
                    categoryList.appendChild(li);
                });

                shoppingListContainer.appendChild(categoryList);
            });
            
            totalCompradoSpan.textContent = data.total_comprado.toFixed(2);
            totalEstimativaSpan.textContent = data.total_estimativa.toFixed(2);

        } catch (error) {
            console.error('Erro ao buscar itens:', error);
            handleAuthError(error);
        }
    }

    /**
     * Retorna o HTML para um item no modo "visualização"
     */
    function createItemViewHtml(item) {
        const subtotal = (item.quantity * item.price).toFixed(2);
        return `
            <div class="item-details">
                <input type="checkbox" class="toggle-complete" ${item.completed ? 'checked' : ''}>
                <div class="item-text-container">
                    <div class="item-text">
                        <strong>${item.name}</strong>
                        <span>${item.quantity} un. x R$ ${item.price.toFixed(2)} = R$ ${subtotal}</span>
                    </div>
                </div>
            </div>
            <button class="delete-btn">🗑️</button>
        `;
    }
    
    /**
     * Retorna o HTML para um item no modo "edição"
     */
    function createItemEditHtml(item) {
        const priceAsNumber = parseFloat(item.price);
        const categoryValue = (item.category === "Outros") ? "" : item.category;

        return `
            <form class="item-edit-form">
                <div class="item-edit-inputs">
                    <input type="text" class="edit-name" value="${item.name}" required>
                    <input type="number" class="edit-quantity" value="${item.quantity}" min="1" required>
                    <input type="number" class="edit-price" value="${priceAsNumber.toFixed(2)}" step="0.01" min="0" required>
                </div>
                <div class="form-group-edit">
                    <label>Categoria</label>
                    <input type="text" class="edit-category" value="${categoryValue}" placeholder="Ex: Laticínios">
                </div>
                <div class="item-edit-buttons">
                    <button type="button" class="cancel-edit-btn">Cancelar</button>
                    <button type="submit" class="save-edit-btn">Salvar</button>
                </div>
            </form>
        `;
    }

    /**
     * Adiciona um novo item à lista
     */
    async function addItem() {
        const name = nameInput.value.trim();
        const quantity = parseInt(quantityInput.value, 10);
        const priceStr = priceInput.value.trim();
        const category = categoryInput.value.trim();
        let price;

        if (name === '' || isNaN(quantity) || quantity <= 0) {
            alert('Nome do item e Quantidade são obrigatórios.');
            return;
        }
        if (priceStr !== '' && isNaN(parseFloat(priceStr))) {
            alert('O preço digitado não é um número válido.');
            return;
        }
        price = (priceStr === '' || parseFloat(priceStr) === 0) ? 0 : parseFloat(priceStr);

        try {
            await fetch(`${API_URL}/lists/${ACTIVE_LIST_ID}/items`, {
                method: 'POST',
                headers: authHeaders,
                body: JSON.stringify({ name, quantity, price, category }), 
            });
            nameInput.value = '';
            quantityInput.value = '1';
            priceInput.value = '';
            categoryInput.value = '';
            priceSuggestionSmall.textContent = '';
            fetchItems();
        } catch (error) {
            console.error('Erro ao adicionar item:', error);
        }
    }

    // --- FUNÇÕES DE ATUALIZAÇÃO ---
    async function deleteItem(itemId) {
        try {
            await fetch(`${API_URL}/items/${itemId}`, { method: 'DELETE', headers: authHeaders });
            fetchItems();
        } catch (error) {
            console.error('Erro ao excluir item:', error);
        }
    }

    async function toggleComplete(itemId) {
        try {
            await fetch(`${API_URL}/items/${itemId}/toggle`, {
                method: 'PUT',
                headers: authHeaders
            });
            fetchItems();
        } catch (error) {
            console.error('Erro ao marcar item:', error);
        }
    }

    async function updateItem(itemId, name, quantity, price, category) {
        if (name === '' || isNaN(quantity) || quantity <= 0 || isNaN(price) || price < 0) {
            alert('Todos os campos devem ser preenchidos corretamente.');
            return;
        }
        try {
            await fetch(`${API_URL}/items/${itemId}`, {
                method: 'PUT',
                headers: authHeaders,
                body: JSON.stringify({ name, quantity, price, category })
            });
            fetchItems();
        } catch (error) {
            console.error('Erro ao atualizar item:', error);
        }
    }

    // --- FUNÇÕES DE AUTENTICAÇÃO E NAVEGAÇÃO ---
    async function renameList() {
        const newName = listNameInput.value.trim();
        if (newName === '') return;
        try {
            await fetch(`${API_URL}/lists/${ACTIVE_LIST_ID}/rename`, {
                method: 'PUT',
                headers: authHeaders,
                body: JSON.stringify({ name: newName })
            });
        } catch (error) {
            console.error('Erro ao renomear lista:', error);
        }
    }

    async function finalizeList() {
        if (!confirm('Deseja finalizar e salvar esta lista? Uma nova lista ativa será criada.')) {
            return;
        }
        try {
            await renameList();
            await fetch(`${API_URL}/lists/${ACTIVE_LIST_ID}/finalize`, {
                method: 'POST',
                headers: authHeaders
            });
            alert('Lista salva com sucesso!');
            window.location.href = '/dashboard';
        } catch (error) {
            console.error('Erro ao finalizar lista:', error);
        }
    }

    async function getPriceSuggestion() {
        const name = nameInput.value.trim();
        if (name.length < 2) {
            priceSuggestionSmall.textContent = '';
            return;
        }
        try {
            const response = await fetch(`${API_URL}/items/suggest-price/${name}`, { headers: authHeaders });
            if (response.ok) {
                const data = await response.json();
                priceSuggestionSmall.textContent = `Sugestão: R$ ${data.suggested_price.toFixed(2)}`;
                if (data.suggested_category && data.suggested_category !== "Outros") {
                    categoryInput.value = data.suggested_category;
                }
            } else {
                priceSuggestionSmall.textContent = '';
            }
        } catch (error) {
            console.error('Erro ao buscar sugestão:', error);
        }
    }

    async function initializePage() {
        try {
            const response = await fetch(`${API_URL}/active-list`, { headers: authHeaders });
            if (!response.ok) throw new Error('Falha ao buscar lista ativa');
            
            const data = await response.json();
            ACTIVE_LIST_ID = data.id;
            
            fetchItems();
        } catch(error) {
            console.error('Erro ao inicializar página:', error);
            handleAuthError(error);
        }
    }
    
    function handleAuthError(error) {
        console.error("Erro de autenticação ou servidor:", error);
        localStorage.removeItem('shopping-list-token');
        window.location.href = '/login';
    }

    // --- Event Listeners ---
    addButton.addEventListener('click', addItem);
    nameInput.addEventListener('input', getPriceSuggestion);
    finalizeButton.addEventListener('click', finalizeList);
    listNameInput.addEventListener('blur', renameList);
    
    logoutButton.addEventListener('click', () => {
        localStorage.removeItem('shopping-list-token');
        window.location.href = '/login';
    });

    /**
     * --- O Click Listener principal ---
     */
    shoppingListContainer.addEventListener('click', (event) => {
        const target = event.target;
        const listItem = target.closest('.list-item'); 
        if (!listItem) return;
        
        const itemId = listItem.dataset.id;

        // 1. Clicou no botão de DELETAR
        if (target.classList.contains('delete-btn')) {
            deleteItem(itemId);
            return;
        }
        
        // 2. Clicou no CHECKBOX
        if (target.classList.contains('toggle-complete')) {
            toggleComplete(itemId);
            return;
        }

        // 3. Clicou na ÁREA DE TEXTO para EDITAR
        if (target.closest('.item-text-container')) {
            const item = listItem.dataset;
            listItem.classList.add('editing'); 
            listItem.innerHTML = createItemEditHtml(item);
            return;
        }
        
        // 4. Clicou no botão SALVAR EDIÇÃO
        if (target.classList.contains('save-edit-btn')) {
            event.preventDefault(); 
            const form = target.closest('.item-edit-form');
            const name = form.querySelector('.edit-name').value;
            const quantity = parseFloat(form.querySelector('.edit-quantity').value);
            const price = parseFloat(form.querySelector('.edit-price').value);
            const category = form.querySelector('.edit-category').value;
            
            updateItem(itemId, name, quantity, price, category);
            return;
        }

        // 5. Clicou no botão CANCELAR EDIÇÃO
        if (target.classList.contains('cancel-edit-btn')) {
            event.preventDefault();
            fetchItems();
            return;
        }
    });

    // --- Inicialização ---
    initializePage();
});