import { HttpService } from '@nestjs/axios';
import { Header, Injectable, Logger } from '@nestjs/common';
import { models } from './models';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class AppService {
  private readonly logger = new Logger(AppService.name);
  constructor(private readonly httpService: HttpService) {}

  @Header('Content-Type', 'application/json')
  getModels() {
    return models;
  }

  getVersion(): string {
    return 'Hello World! 2.0';
  }

  async getCompletions(
    endpoint: string,
    mapping: string,
    azureApiKey: string,
    body: any,
    stream: boolean,
    apiVersion: string,
  ) {
    const deploymentId = this.getDeploymentId(mapping, body['model']);
    this.logger.debug(`deploymentId: ${deploymentId}`);
    const url = `${endpoint}/openai/deployments/${deploymentId}/chat/completions?api-version=${apiVersion}`;
    const headers = {
      'api-key': azureApiKey,
      'Content-Type': 'application/json',
    };
    const config = { headers: headers };
    if (stream) {
      config['responseType'] = 'stream';
    }
    const response = this.httpService.post(url, body, config);
    try {
      return await firstValueFrom(response);
    } catch (e) {
      return e.response;
    }
  }
  //openai embedding的代理请求 by chenhao
  async getEmbeddings(endpoint: string, mapping: string, azureApiKey: string, body: any, apiVersion: string) {
    const deploymentId = this.getDeploymentId(mapping, body['model']);
    //openai支持多input，且用数组形式传递，azure只支持一个，所以用\n分割组成一个
    //openai支持input最大8192个token，azure只支持一2048个token
    const newBody = { model: body['model'], input: body['input'].join('\n') };

    this.logger.debug(`deploymentId: ${deploymentId}`);
    //azure部署embedding的时候要按规则建立名称${deploymentId}-${body['model']}
    const url = `${endpoint}/openai/deployments/${deploymentId}-${body['model']}/embeddings?api-version=${apiVersion}`;
    const headers = {
      'api-key': azureApiKey,
      'Content-Type': 'application/json',
    };
    const config = { headers: headers };
    this.logger.debug(`url: ${url}`);
    const response = this.httpService.post(url, newBody, config);
    try {
      return await firstValueFrom(response);
    } catch (e) {
      return e.response;
    }
  }

  private getDeploymentId(mapping: string, model: string): string {
    this.logger.debug(`mapping: ${mapping}, model: ${model}`);
    if (mapping.includes('|')) {
      let defaultDeploymentId = '';
      const modelMapping = mapping.split(',').reduce((acc: Record<string, string>, pair: string) => {
        const [key, value] = pair.split('|');
        if (!defaultDeploymentId) {
          defaultDeploymentId = value;
        }
        acc[key] = value;
        return acc;
      }, {});

      if (!model) {
        return defaultDeploymentId;
      }

      return modelMapping[model] || defaultDeploymentId;
    }

    return mapping;
  }
}
