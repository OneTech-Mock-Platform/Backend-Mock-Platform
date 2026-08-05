import { All, Controller, Param, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { MockProxyService } from './mock-proxy.service';
import { randomUUID } from 'crypto';

@Controller('mock')
export class MockProxyController {
  constructor(private readonly mockProxyService: MockProxyService) {}

  @All(':specId/*splat')
  async handle(@Param('specId') specId: string, @Req() req: Request, @Res() res: Response) {

    res.setHeader('X-Request-Id', randomUUID());
    res.setHeader('X-Timestamp', new Date().toISOString());

    const requestedPath = req.path.replace(`/mock/${specId}`, '') || '/';
    const preferHeader = req.headers['prefer'] as string | undefined;

    const result = await this.mockProxyService.resolve({
      specId,
      method: req.method,
      requestedPath,
      preferHeader,
    });

    if ('error' in result) {
      res.status(404).json({ message: result.message });
      return;
    }

    const { scenario } = result;

    if (scenario.delayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, scenario.delayMs));
    }

    if (scenario.headers && typeof scenario.headers === 'object') {
      for (const [key, value] of Object.entries(scenario.headers as Record<string, string>)) {
        res.setHeader(key, value);
      }
    }

    res.status(scenario.statusCode);

    if (!scenario.mockContent) {
      res.end();
      return;
    }

    if (scenario.contentType?.includes('json')) {
      try {
        res.json(JSON.parse(scenario.mockContent));
      } catch {
        res.send(scenario.mockContent);
      }
      return;
    }

    if (scenario.contentType) {
      res.setHeader('Content-Type', scenario.contentType);
    }
    res.send(scenario.mockContent);
  }
}
