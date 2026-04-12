import { JwtService } from '@nestjs/jwt';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import {
  WsDeploymentCompletePayload,
  WsDeploymentLogPayload,
  WsDeploymentStatusPayload,
  WsEvents,
  WsInfraProgressPayload,
} from '@liftoff/shared';
import { Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';

type HandshakeAuth = {
  token?: unknown;
};

type HandshakeHeaders = {
  authorization?: unknown;
};

/**
 * WebSocket gateway for real-time deployment events.
 */
@WebSocketGateway({
  namespace: '/deployments',
  cors: {
    origin: '*',
    credentials: true,
  },
})
export class EventsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  private server!: Server;

  private readonly logger = new Logger(EventsGateway.name);

  public constructor(private readonly jwtService: JwtService) {}

  public async handleConnection(client: Socket): Promise<void> {
    const token = this.resolveToken(client);

    if (!token) {
      this.logger.warn(`Socket ${client.id} connected without token`);
      client.disconnect(true);
      return;
    }

    try {
      await this.jwtService.verifyAsync(token);
    } catch {
      this.logger.warn(`Socket ${client.id} failed JWT verification`);
      client.disconnect(true);
    }
  }

  public handleDisconnect(client: Socket): void {
    this.logger.debug(`Socket disconnected: ${client.id}`);
  }

  @SubscribeMessage(WsEvents.JOIN_DEPLOYMENT)
  public joinDeployment(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { deploymentId: string },
  ): void {
    client.join(this.getDeploymentRoom(payload.deploymentId));
  }

  @SubscribeMessage(WsEvents.JOIN_ENVIRONMENT)
  public joinEnvironment(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { environmentId: string },
  ): void {
    client.join(this.getEnvironmentRoom(payload.environmentId));
  }

  @SubscribeMessage(WsEvents.LEAVE_DEPLOYMENT)
  public leaveDeployment(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { deploymentId: string },
  ): void {
    client.leave(this.getDeploymentRoom(payload.deploymentId));
  }

  @SubscribeMessage(WsEvents.LEAVE_ENVIRONMENT)
  public leaveEnvironment(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { environmentId: string },
  ): void {
    client.leave(this.getEnvironmentRoom(payload.environmentId));
  }

  /**
   * Broadcasts a deployment status update.
   */
  public broadcastDeploymentStatus(payload: WsDeploymentStatusPayload): void {
    this.server.to(this.getDeploymentRoom(payload.deploymentId)).emit(WsEvents.DEPLOYMENT_STATUS, payload);
  }

  /**
   * Broadcasts a deployment log line.
   */
  public broadcastDeploymentLog(payload: WsDeploymentLogPayload): void {
    this.server.to(this.getDeploymentRoom(payload.deploymentId)).emit(WsEvents.DEPLOYMENT_LOG, payload);
  }

  /**
   * Broadcasts deployment completion payload.
   */
  public broadcastDeploymentComplete(payload: WsDeploymentCompletePayload): void {
    this.server
      .to(this.getDeploymentRoom(payload.deploymentId))
      .emit(WsEvents.DEPLOYMENT_COMPLETE, payload);
  }

  /**
   * Broadcasts infrastructure progress payload.
   */
  public broadcastInfraProgress(payload: WsInfraProgressPayload): void {
    this.server
      .to(this.getDeploymentRoom(payload.deploymentId))
      .emit(WsEvents.INFRASTRUCTURE_PROGRESS, payload);
  }

  private resolveToken(client: Socket): string | undefined {
    const authToken = (client.handshake.auth as HandshakeAuth | undefined)?.token;
    if (typeof authToken === 'string' && authToken.length > 0) {
      return authToken;
    }

    const authorization = (client.handshake.headers as HandshakeHeaders | undefined)?.authorization;
    if (typeof authorization === 'string' && authorization.startsWith('Bearer ')) {
      return authorization.slice(7);
    }

    return undefined;
  }

  private getDeploymentRoom(deploymentId: string): string {
    return `deployment:${deploymentId}`;
  }

  private getEnvironmentRoom(environmentId: string): string {
    return `environment:${environmentId}`;
  }
}
