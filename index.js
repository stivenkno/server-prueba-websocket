import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';

const PORT = process.env.PORT || 3000;
const CORS_ORIGIN = process.env.CORS_ORIGIN || '';
const API_KEY = process.env.API_KEY || '';

if (!API_KEY) {
    console.error('ERROR: La variable de entorno API_KEY no está definida.');
    process.exit(1);
}

const app = express();
const httpServer = createServer(app);

const io = new Server(httpServer, {
    cors: {
        origin: '*',
        methods: ['GET', 'POST'],
    },
});

app.use(express.json());

const pendientes = new Map();
const MAX_PENDIENTES_POR_USUARIO = 20;

function verificarApiKey(req, res, next) {
    const key = req.headers['x-api-key'];
    console.log('Verificando API_KEY:', key);

    if (!key || key !== API_KEY) {
        console.warn('API_KEY inválida:', key);
        return res.status(401).json({ error: 'No autorizado' });
    }

    next();
}

app.get('/health', (_req, res) => {
    console.log('Health check recibido');
    res.status(200).json({ status: 'ok' });
});

app.post('/notify-job-complete', verificarApiKey, (req, res) => {
    const { user_id, mensaje, url } = req.body;
    console.log('POST /notify-job-complete recibido:', req.body);

    if (!user_id || !url) {
        console.warn('Datos faltantes en notify-job-complete');
        return res.status(400).json({ error: 'Faltan datos obligatorios: user_id, url' });
    }

    const data = {
        mensaje: mensaje || 'Tu informe está listo',
        url,
    };

    const room = `user_${user_id}`;
    const hayConectado = io.sockets.adapter.rooms.get(room)?.size > 0;
    console.log(`Room ${room} conectado?:`, hayConectado);

    if (hayConectado) {
        console.log('Emitiendo informe-listo a sala:', room, data);
        io.to(room).emit('informe-listo', data);
    } else {
        console.log('Usuario no conectado, guardando en pendientes');
        if (!pendientes.has(user_id)) {
            pendientes.set(user_id, []);
        }

        const cola = pendientes.get(user_id);
        if (cola.length < MAX_PENDIENTES_POR_USUARIO) {
            cola.push(data);
            console.log(`Pendientes para ${user_id}:`, cola);
        } else {
            console.warn(`Cola de pendientes llena para usuario ${user_id}`);
        }
    }

    return res.status(200).json({ success: true });
});

io.on('connection', (socket) => {
    console.log('Nuevo socket conectado:', socket.id);

    socket.on('join', (userId) => {
        console.log(`Socket ${socket.id} intentando unirse a user_${userId}`);

        if (!userId) {
            console.warn('join recibido sin userId');
            return;
        }

        const room = `user_${userId}`;
        socket.join(room);
        console.log(`Socket ${socket.id} unido a room: ${room}`);

        const mensajesPendientes = pendientes.get(userId);
        if (mensajesPendientes) {
            console.log('Enviando mensajes pendientes a', userId, mensajesPendientes);
            mensajesPendientes.forEach(msg => socket.emit('informe-listo', msg));
            pendientes.delete(userId);
        } else {
            console.log('No hay mensajes pendientes para', userId);
        }
    });

    socket.on('disconnect', (reason) => {
        console.log('Socket desconectado:', socket.id, 'razón:', reason);
    });
});

httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`Servidor corriendo en el puerto ${PORT}`);
});

process.on('SIGTERM', () => {
    console.log('SIGTERM recibido, cerrando servidor...');
    httpServer.close(() => process.exit(0));
});

process.on('SIGINT', () => {
    console.log('SIGINT recibido, cerrando servidor...');
    httpServer.close(() => process.exit(0));
});