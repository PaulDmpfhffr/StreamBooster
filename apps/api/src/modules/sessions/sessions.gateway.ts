import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { PrismaService } from '../prisma/prisma.service';

@WebSocketGateway({ namespace: '/admin/sessions', cors: true })
export class SessionsGateway implements OnGatewayConnection {
  @WebSocketServer()
  server!: Server;

  constructor(private prisma: PrismaService) {}

  async handleConnection(_client: Socket) {
    const sessions = await this.prisma.session.findMany({
      where: { status: 'active' },
      include: { user: { select: { email: true } } },
    });
    _client.emit('sessions:list', sessions);
  }

  @SubscribeMessage('sessions:refresh')
  async handleRefresh(client: Socket) {
    const sessions = await this.prisma.session.findMany({
      where: { status: 'active' },
      include: { user: { select: { email: true } } },
    });
    client.emit('sessions:list', sessions);
  }

  broadcastSessionUpdate(session: { id: string; status: string }) {
    this.server.emit('session:update', session);
  }
}
