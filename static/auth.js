document.addEventListener('DOMContentLoaded', () => {
    // Procura os botões nas páginas de login e cadastro
    const isLoginPage = !!document.getElementById('login-button');
    const isRegisterPage = !!document.getElementById('register-button');
    
    // URL do nosso servidor
    const API_URL = 'http://127.0.0.1:5000/api';
    
    // Pega os campos de usuário, senha e mensagem de erro
    const usernameInput = document.getElementById('username');
    const passwordInput = document.getElementById('password');
    const errorMessageP = document.getElementById('error-message');

    /**
     * Função para lidar com o CADASTRO
     */
    const handleRegister = async () => {
        const username = usernameInput.value.trim();
        const password = passwordInput.value.trim();

        if (!username || !password) {
            errorMessageP.textContent = 'Por favor, preencha todos os campos.';
            return;
        }

        try {
            const response = await fetch(`${API_URL}/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });

            const data = await response.json();
            if (response.ok) {
                alert('Cadastro realizado com sucesso! Você será redirecionado para o login.');
                window.location.href = '/login';
            } else {
                errorMessageP.textContent = data.message || 'Erro ao cadastrar.';
            }
        } catch (error) {
            errorMessageP.textContent = 'Erro de conexão com o servidor.';
        }
    };

    /**
     * Função para lidar com o LOGIN
     */
    const handleLogin = async () => {
        const username = usernameInput.value.trim();
        const password = passwordInput.value.trim();

        if (!username || !password) {
            errorMessageP.textContent = 'Por favor, preencha todos os campos.';
            return;
        }

        try {
            const response = await fetch(`${API_URL}/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });
            
            const data = await response.json();
            if (response.ok) {
                localStorage.setItem('shopping-list-token', data.token);
                window.location.href = '/dashboard'; 
            } else {
                errorMessageP.textContent = data.message || 'Erro ao fazer login.';
            }
        } catch (error) {
            errorMessageP.textContent = 'Erro de conexão com o servidor.';
        }
    };


    // --- "Ligar" os botões ---
    if (isRegisterPage) {
        document.getElementById('register-button').addEventListener('click', handleRegister);
    }

    if (isLoginPage) {
        document.getElementById('login-button').addEventListener('click', handleLogin);
    }
});