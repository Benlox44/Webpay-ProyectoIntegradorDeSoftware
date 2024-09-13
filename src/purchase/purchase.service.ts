import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import axios, { AxiosResponse } from 'axios';
import * as jwt from 'jsonwebtoken';
import * as amqp from 'amqplib/callback_api';

export interface WebpayResponse {
  url: string;
  token: string;
}

export interface WebpayReturnResponse {
  status: string;
}

@Injectable()
export class PurchaseService {
  async initTransaction(authHeader: string, totalAmount: number): Promise<WebpayResponse | null> {
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new HttpException('No se proporcionó un token válido', HttpStatus.UNAUTHORIZED);
    }

    const token = authHeader.split(' ')[1];
    try {
      const decoded: any = jwt.verify(token, 'your_secret_key');
      const userId = decoded.id;

      // Lógica de Webpay
      const buyOrder = Math.floor(Math.random() * 100000);
      const sessionId = Math.floor(Math.random() * 100000);
      const returnUrl = `http://localhost:3003/purchase/return`;

      const data = JSON.stringify({
        buy_order: buyOrder,
        session_id: sessionId,
        amount: Math.round(totalAmount),
        return_url: returnUrl,
      });

      const method = 'POST';
      const type = 'sandbox';
      const endpoint = '/rswebpaytransaction/api/webpay/v1.0/transactions';

      const response = await this.getWs(data, method, type, endpoint);
      return response;
    } catch (error) {
      throw new HttpException('Token inválido o expirado', HttpStatus.UNAUTHORIZED);
    }
  }

  async returnTransaction(token: string, userId: string): Promise<boolean> {
    if (!token) {
      throw new HttpException('No se recibió el token de Webpay', HttpStatus.BAD_REQUEST);
    }

    const method = 'PUT';
    const type = 'sandbox';
    const endpoint = `/rswebpaytransaction/api/webpay/v1.0/transactions/${token}`;

    const response: WebpayReturnResponse | null = await this.getWs(null, method, type, endpoint);

    if (response && response.status === 'AUTHORIZED') {
      // Lógica para interactuar con RabbitMQ y enviar correos, si es necesario
      // Aquí debes implementar la lógica de RabbitMQ para obtener el correo y nombre del usuario y enviar el correo

      return true; // Indicar que la transacción fue autorizada
    } else {
      return false; // Indicar que la transacción no fue autorizada
    }
  }

  private async getWs(data: any, method: string, type: string, endpoint: string): Promise<any> {
    const baseUrl = type === 'live' ? 'https://webpay3g.transbank.cl' : 'https://webpay3gint.transbank.cl';
    const TbkApiKeyId = '597055555532';
    const TbkApiKeySecret = '579B532A7440BB0C9079DED94D31EA1615BACEB56610332264630D42D0A36B1C';

    try {
      const response: AxiosResponse<any> = await axios({
        method: method,
        url: baseUrl + endpoint,
        headers: {
          'Tbk-Api-Key-Id': TbkApiKeyId,
          'Tbk-Api-Key-Secret': TbkApiKeySecret,
          'Content-Type': 'application/json',
        },
        data: data,
      });

      return response.data;
    } catch (error) {
      console.error('Error al conectar con Webpay:', error);
      return null;
    }
  }
}
