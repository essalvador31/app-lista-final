import jwt
from datetime import datetime, timedelta, timezone
from functools import wraps
from flask import Flask, request, jsonify, render_template, redirect, url_for
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy
from werkzeug.security import generate_password_hash, check_password_hash
import os
from collections import defaultdict 

# --- Configuração da Aplicação ---
app = Flask(__name__)
CORS(app)

basedir = os.path.abspath(os.path.dirname(__file__))
app.config['SECRET_KEY'] = 'minha-chave-secreta-super-segura'

# --- A GRANDE MUDANÇA (Base de Dados para PostgreSQL) ---
# 1. Procura por uma DATABASE_URL (que o Render vai nos dar)
database_url = os.environ.get('DATABASE_URL')

if database_url:
    # Se ESTIVER na internet (no Render)
    
    # O Render usa "postgres://", mas o SQLAlchemy prefere "postgresql://"
    # Esta linha corrige isso automaticamente.
    if database_url.startswith("postgres://"):
        database_url = database_url.replace("postgres://", "postgresql://", 1)
        
    app.config['SQLALCHEMY_DATABASE_URI'] = database_url
else:
    # Se ESTIVER no seu PC
    # Continua a usar o bom e velho database.db (SQLite)
    app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///' + os.path.join(basedir, 'database.db')

app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

db = SQLAlchemy(app)

# --- CRIA AS TABELAS (CORREÇÃO FINAL) ---
# Movemos o db.create_all() para aqui.
# O Gunicorn vai ler isto e criar as tabelas antes de ligar.
with app.app_context():
    db.create_all()
# ----------------------------------------


# --- Modelos do Banco de Dados (Sem alteração) ---
# --- Modelos do Banco de Dados (ajuste: definir explicitamente os nomes das tabelas) ---
class User(db.Model):
    __tablename__ = 'users'  # <- evita conflito com palavra reservada "user"
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    password_hash = db.Column(db.String(256), nullable=False)
    shopping_lists = db.relationship('ShoppingList', backref='owner', lazy=True, cascade="all, delete-orphan")
    price_history = db.relationship('PriceHistory', backref='owner', lazy=True, cascade="all, delete-orphan")

class ShoppingList(db.Model):
    __tablename__ = 'shopping_list'
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False, default="Nova Lista")
    created_date = db.Column(db.DateTime, nullable=False, default=lambda: datetime.now(timezone.utc))
    is_active = db.Column(db.Boolean, default=True, nullable=False)
    total_price = db.Column(db.Float, default=0.0)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)  # <- mudou para 'users.id'
    items = db.relationship('ShoppingListItem', backref='list', lazy=True, cascade="all, delete-orphan")

class ShoppingListItem(db.Model):
    __tablename__ = 'shopping_list_item'
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    quantity = db.Column(db.Integer, nullable=False)
    price = db.Column(db.Float, nullable=False)
    completed = db.Column(db.Boolean, default=False, nullable=False)
    list_id = db.Column(db.Integer, db.ForeignKey('shopping_list.id'), nullable=False)
    category = db.Column(db.String(100), nullable=True, default="Outros")

class PriceHistory(db.Model):
    __tablename__ = 'price_history'
    id = db.Column(db.Integer, primary_key=True)
    item_name_lower = db.Column(db.String(100), nullable=False, index=True)
    price = db.Column(db.Float, nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)  # <- mudou para 'users.id'
    category = db.Column(db.String(100), nullable=True, default="Outros")


# --- O RESTO DO app.py (sem alteração) ---
def token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        token = None
        if 'Authorization' in request.headers:
            token = request.headers['Authorization'].split(" ")[1]
        if not token:
            return jsonify({'message': 'Token is missing!'}), 401
        try:
            data = jwt.decode(token, app.config['SECRET_KEY'], algorithms=["HS256"])
            current_user = User.query.filter_by(username=data['username']).first()
            if not current_user:
                return jsonify({'message': 'User not found!'}), 401
        except Exception as e:
            return jsonify({'message': f'Token is invalid! {e}'}), 401
        return f(current_user, *args, **kwargs)
    return decorated

@app.route('/')
def root(): return redirect(url_for('dashboard_page'))

@app.route('/dashboard')
def dashboard_page(): return render_template('dashboard.html')

@app.route('/list')
def list_page(): return render_template('index.html')

@app.route('/login')
def login_page(): return render_template('login.html')

@app.route('/register')
def register_page(): return render_template('register.html')

@app.route('/list/<int:list_id>')
def list_detail_page(list_id):
    return render_template('list_detail.html')

@app.route('/api/register', methods=['POST'])
def register():
    data = request.get_json()
    if User.query.filter_by(username=data['username']).first():
        return jsonify({'message': 'Usuário já existe!'}), 409
    hashed_password = generate_password_hash(data['password'], method='pbkdf2:sha256')
    new_user = User(username=data['username'], password_hash=hashed_password)
    db.session.add(new_user)
    db.session.commit()
    return jsonify({'message': 'Usuário criado com sucesso!'}), 201

@app.route('/api/login', methods=['POST'])
def login():
    data = request.get_json()
    user = User.query.filter_by(username=data['username']).first()
    if not user or not check_password_hash(user.password_hash, data['password']):
        return jsonify({'message': 'Credenciais inválidas!'}), 401
    token = jwt.encode({
        'username': user.username,
        'exp': datetime.now(timezone.utc) + timedelta(hours=24)
    }, app.config['SECRET_KEY'], algorithm="HS256")
    return jsonify({'token': token})

@app.route('/api/dashboard', methods=['GET'])
@token_required
def get_saved_lists(current_user):
    lists = ShoppingList.query.filter_by(user_id=current_user.id, is_active=False).order_by(ShoppingList.created_date.desc()).all()
    output = [{'id': l.id, 'name': l.name, 'created_date': l.created_date, 'total_price': l.total_price} for l in lists]
    return jsonify(output)

@app.route('/api/active-list', methods=['GET'])
@token_required
def get_active_list(current_user):
    active_list = ShoppingList.query.filter_by(user_id=current_user.id, is_active=True).first()
    if not active_list:
        active_list = ShoppingList(name="Nova Lista", owner=current_user, is_active=True)
        db.session.add(active_list)
        db.session.commit()
    return jsonify({'id': active_list.id, 'name': active_list.name})

@app.route('/api/lists/<int:list_id>/rename', methods=['PUT'])
@token_required
def rename_list(current_user, list_id):
    lista = ShoppingList.query.filter_by(id=list_id, user_id=current_user.id).first_or_404()
    data = request.get_json()
    lista.name = data['name']
    db.session.commit()
    return jsonify({'message': 'List name updated'})

@app.route('/api/lists/<int:list_id>/finalize', methods=['POST'])
@token_required
def finalize_list(current_user, list_id):
    lista = ShoppingList.query.filter_by(id=list_id, user_id=current_user.id, is_active=True).first_or_404()
    total = sum(item.quantity * item.price for item in lista.items)
    lista.is_active = False
    lista.total_price = total
    db.session.commit()
    return jsonify({'message': 'List finalized and saved!'})

@app.route('/api/lists/<int:list_id>/items', methods=['GET'])
@token_required
def get_items(current_user, list_id):
    lista = ShoppingList.query.filter_by(id=list_id, user_id=current_user.id).first_or_404()
    items = sorted(lista.items, key=lambda x: (x.category or "Outros", x.name))
    
    total_estimativa = sum(item.quantity * item.price for item in items)
    total_comprado = sum(item.quantity * item.price for item in items if item.completed)
    
    items_agrupados = defaultdict(list)
    for item in items:
        categoria = item.category if item.category else "Outros" 
        items_agrupados[categoria].append({
            'id': item.id, 
            'name': item.name, 
            'quantity': item.quantity, 
            'price': item.price, 
            'completed': item.completed,
            'category': categoria
        })
    
    return jsonify({
        "items_agrupados": items_agrupados, 
        "total_estimativa": total_estimativa, 
        "total_comprado": total_comprado, 
        "list_name": lista.name
    })

@app.route('/api/lists/<int:list_id>/items', methods=['POST'])
@token_required
def add_item(current_user, list_id):
    lista = ShoppingList.query.filter_by(id=list_id, user_id=current_user.id, is_active=True).first_or_404()
    data = request.get_json()
    price = data['price']
    
    category = data.get('category')
    if not category:
        category = "Outros"
    
    item_name_lower = data['name'].lower()
    
    if price == 0:
        last_price_record = PriceHistory.query.filter_by(user_id=current_user.id, item_name_lower=item_name_lower).order_by(PriceHistory.id.desc()).first()
        if last_price_record:
            price = last_price_record.price
            
    new_item = ShoppingListItem(
        name=data['name'], 
        quantity=data['quantity'], 
        price=price, 
        list=lista,
        category=category
    )
    db.session.add(new_item)

    if price > 0:
        new_price_record = PriceHistory(
            item_name_lower=item_name_lower,
            price=price,
            owner=current_user,
            category=category 
        )
        db.session.add(new_price_record)
    
    db.session.commit()
    return jsonify({'id': new_item.id, 'name': new_item.name, 'quantity': new_item.quantity, 'price': new_item.price, 'completed': new_item.completed, 'category': new_item.category}), 201

@app.route('/api/items/<int:item_id>', methods=['PUT'])
@token_required
def update_item(current_user, item_id):
    item = ShoppingListItem.query.get_or_404(item_id)
    if item.list.owner != current_user:
        return jsonify({"error": "Unauthorized"}), 403
    
    data = request.get_json()
    price = data['price']
    category = data.get('category')
    if not category:
        category = "Outros"
    
    item.name = data['name']
    item.quantity = data['quantity']
    item.price = price
    item.category = category
    
    if price > 0:
        new_price_record = PriceHistory(
            item_name_lower=data['name'].lower(),
            price=price,
            owner=current_user,
            category=category
        )
        db.session.add(new_price_record)
    
    db.session.commit()
    return jsonify({"success": True})

@app.route('/api/items/<int:item_id>/toggle', methods=['PUT'])
@token_required
def toggle_item(current_user, item_id):
    item = ShoppingListItem.query.get_or_404(item_id)
    if item.list.owner != current_user:
        return jsonify({"error": "Unauthorized"}), 403
    item.completed = not item.completed
    db.session.commit()
    return jsonify({'id': item.id, 'completed': item.completed})

@app.route('/api/items/<int:item_id>', methods=['DELETE'])
@token_required
def delete_item(current_user, item_id):
    item = ShoppingListItem.query.get_or_404(item_id)
    if item.list.owner != current_user:
        return jsonify({"error": "Unauthorized"}), 403
    db.session.delete(item)
    db.session.commit()
    return jsonify({"success": True})

@app.route('/api/lists/<int:list_id>', methods=['DELETE'])
@token_required
def delete_list(current_user, list_id):
    lista = ShoppingList.query.filter_by(id=list_id, user_id=current_user.id, is_active=False).first_or_404()
    db.session.delete(lista)
    db.session.commit()
    return jsonify({"success": True})

@app.route('/api/items/suggest-price/<item_name>', methods=['GET'])
@token_required
def suggest_price(current_user, item_name):
    last_price_record = PriceHistory.query.filter_by(
        user_id=current_user.id,
        item_name_lower=item_name.lower()
    ).order_by(PriceHistory.id.desc()).first()
    
    if last_price_record:
        return jsonify({
            "suggested_price": last_price_record.price,
            "suggested_category": last_price_record.category
        })
    return jsonify({}), 404

# --- Execução ---
if __name__ == '__main__':
    # O db.create_all() foi movido para o topo do ficheiro,
    # para que o Gunicorn o possa executar.
    app.run(debug=True)
    
    # Versão final pronta para publicar