import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';

const PORT         = process.env.PORT         || 3000;
const CORS_ORIGIN  = process.env.CORS_ORIGIN  || '';
const API_KEY = process.env.API_KEY || '';

if (!API_KEY) {
    console.error('ERROR: La variable de entorno API_KEY no está definida.');
    process.exit(1);
}

const app        = express();
const httpServer = createServer(app);

const io = new Server(httpServer, {
    cors: {
        origin: CORS_ORIGIN ? CORS_ORIGIN.split(',') : [],
        methods: ['GET', 'POST'],
    },
});

app.use(express.json());

const pendientes = new Map();

const MAX_PENDIENTES_POR_USUARIO = 20;

function verificarApiKey(req, res, next) {
    const key = req.headers['x-api-key'];

    if (!key || key !== API_KEY) {
        return res.status(401).json({ error: 'No autorizado' });
    }

    next();
}

app.get('/health', (_req, res) => {
    res.status(200).json({ status: 'ok' });
});

app.post('/notify-job-complete', verificarApiKey, (req, res) => {
    const { user_id, mensaje, url } = req.body;

    if (!user_id || !url) {
        return res.status(400).json({ error: 'Faltan datos obligatorios: user_id, url' });
    }

    const data = {
        mensaje: mensaje || 'Tu informe está listo',
        url,
    };

    const room         = `user_${user_id}`;
    const hayConectado = io.sockets.adapter.rooms.get(room)?.size > 0;

    if (hayConectado) {
        io.to(room).emit('informe-listo', data);
    } else {
        if (!pendientes.has(user_id)) {
            pendientes.set(user_id, []);
        }

        const cola = pendientes.get(user_id);

        if (cola.length < MAX_PENDIENTES_POR_USUARIO) {
            cola.push(data);
        }
    }

    return res.status(200).json({ success: true });
});

io.on('connection', (socket) => {

    socket.on('join', (userId) => {
        if (!userId) return;

        const room = `user_${userId}`;
        socket.join(room);

        const mensajesPendientes = pendientes.get(userId);

        if (mensajesPendientes) {
            mensajesPendientes.forEach(msg => socket.emit('informe-listo', msg));
            pendientes.delete(userId);
        }
    });

    socket.on('disconnect', () => {});
});

httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`Servidor corriendo en el puerto ${PORT}`);
});

process.on('SIGTERM', () => {
    httpServer.close(() => process.exit(0));
});

process.on('SIGINT', () => {
    httpServer.close(() => process.exit(0));
});