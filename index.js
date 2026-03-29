import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';

const app = express();
const httpServer = createServer(app);

const io = new Server(httpServer, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

app.use(express.json());

const pendientes = new Map();

app.post('/notify-job-complete', (req, res) => {
    const { user_id, mensaje, url } = req.body;

    if (!user_id || !url) {
        return res.status(400).json({ error: 'Faltan datos obligatorios' });
    }

    const room = `user_${user_id}`;
    const sockets = io.sockets.adapter.rooms.get(room);

    const data = {
        mensaje: mensaje || 'Tu informe está listo',
        url: url
    };

    if (sockets && sockets.size > 0) {
        io.to(room).emit('informe-listo', data);
        console.log(`Enviado en tiempo real a ${user_id}`);
    } else {
        if (!pendientes.has(user_id)) {
            pendientes.set(user_id, []);
        }
        pendientes.get(user_id).push(data);
        console.log(`Guardado pendiente para ${user_id}`);
    }

    return res.status(200).json({ success: true });
});

io.on('connection', (socket) => {

    socket.on('join', (userId) => {
        if (userId) {
            const room = `user_${userId}`;
            socket.join(room);

            console.log(`Cliente unido a sala: ${room}`);

            if (pendientes.has(userId)) {
                const mensajes = pendientes.get(userId);

                mensajes.forEach(msg => {
                    socket.emit('informe-listo', msg);
                });

                pendientes.delete(userId);
                console.log(`Pendientes enviados a ${userId}`);
            }
        }
    });

    socket.on('disconnect', () => {
        console.log('Cliente desconectado');
    });
});

const PORT = process.env.PORT || 3000;

httpServer.listen(PORT, () => {
    console.log(`Servidor ESM corriendo en http://localhost:${PORT}`);
});