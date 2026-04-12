import { createHmac } from 'crypto';
import { HttpService } from '@nestjs/axios';
import { of } from 'rxjs';
import { GitHubService } from './github.service';

type HttpServiceMock = {
  request: jest.Mock;
};

/**
 * Unit tests for GitHubService.
 */
describe('GitHubService', () => {
  let service: GitHubService;
  let httpServiceMock: HttpServiceMock;

  beforeEach(() => {
    httpServiceMock = {
      request: jest.fn(),
    };
    service = new GitHubService(httpServiceMock as unknown as HttpService);
  });

  it('verifyWebhookSignature returns true for valid signature', () => {
    const payload = Buffer.from('{"hello":"world"}', 'utf8');
    const secret = 'webhook-secret';
    const digest = createHmac('sha256', secret).update(payload).digest('hex');
    const signature = `sha256=${digest}`;

    const isValid = service.verifyWebhookSignature(payload, signature, secret);

    expect(isValid).toBe(true);
  });

  it('verifyWebhookSignature returns false for invalid signature', () => {
    const payload = Buffer.from('{"hello":"world"}', 'utf8');
    const secret = 'webhook-secret';

    const isValid = service.verifyWebhookSignature(payload, 'sha256=deadbeef', secret);

    expect(isValid).toBe(false);
  });

  it('upsertActionsSecret encrypts and sends repository secret payload', async () => {
    const encryptionSpy = jest
      .spyOn(
        service as unknown as {
          encryptActionsSecret: (
            secretValue: string,
            base64PublicKey: string,
          ) => Promise<string>;
        },
        'encryptActionsSecret',
      )
      .mockResolvedValue('encrypted-secret-value');

    httpServiceMock.request
      .mockReturnValueOnce(
        of({
          data: {
            key: 'public-key',
            key_id: 'key-id',
          },
        }),
      )
      .mockReturnValueOnce(of({ data: {} }));

    await service.upsertActionsSecret(
      'github-token',
      'liftoff/my-app',
      'LIFTOFF_DEPLOY_SECRET',
      'plain-secret',
    );

    expect(encryptionSpy).toHaveBeenCalledWith('plain-secret', 'public-key');
    expect(httpServiceMock.request).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        method: 'GET',
        url: '/repos/liftoff/my-app/actions/secrets/public-key',
      }),
    );
    expect(httpServiceMock.request).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        method: 'PUT',
        url: '/repos/liftoff/my-app/actions/secrets/LIFTOFF_DEPLOY_SECRET',
        data: {
          encrypted_value: 'encrypted-secret-value',
          key_id: 'key-id',
        },
      }),
    );
  });
});
