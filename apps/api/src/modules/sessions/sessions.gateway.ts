import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  UseGuards,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { WsJwtGuard } from '../auth/guards/ws-jwt.guard';

@WebSocketGateway({ namespace: '/admin/sessions', cors: true })
export class SessionsGateway implements OnGatewayConnection {
  @WebSocketServer()
  server!: Server;

  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private config: ConfigService,
  ) {}

  async handleConnection(client: Socket) {
    const token = client.handshake.auth?.token as string | undefined;
    if (!token) { client.disconnect(true); return; }

    try {
      const payload = this.jwt.verify(token, {
        secret: this.config.get<string>('jwt.secret'),
      }) as { role: string };
      if (payload.role !== 'admin') { client.disconnect(true); return; }
    } catch {
      client.disconnect(true);
      return;
    }

    try {
      const sessions = await this.prisma.session.findMany({
        where: { status: 'active' },
        include: { user: { select: { email: true } } },
      });
      client.emit('sessions:list', sessions);
    } catch {
      client.disconnect(true);
    }
  }

  @UseGuards(WsJwtGuard)
  @SubscribeMessage('sessions:refresh')
  async handleRefresh(client: Socket) {
    const sessions = await this.prisma.session.findMany({
      where: { status: 'active' },
      include: { user: { select: { email: true } } },
    });
    client.emit('sessions:list', sessions);
  }

  broadcastSessionUpdate(session: { id: string; status: string }) {
    this.server?.emit('session:update', session);
  }
}
