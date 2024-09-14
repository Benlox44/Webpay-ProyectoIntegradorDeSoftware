import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import axios, { AxiosResponse } from 'axios';
import * as jwt from 'jsonwebtoken';
import * as amqp from 'amqplib/callback_api';
import * as nodemailer from 'nodemailer';

export interface WebpayResponse {
  url: string;
  token: string;
}

export interface WebpayReturnResponse {
  status: string;
}

@Injectable()
export class PurchaseService {
  private userEmail: string | null = null;
  private userName: string | null = null;

  async initTransaction(authHeader: string, totalAmount: number): Promise<WebpayResponse | null> {
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new HttpException('No se proporcionó un token válido', HttpStatus.UNAUTHORIZED);
    }

    const token = authHeader.split(' ')[1];
    try {
      const decoded: any = jwt.verify(token, 'your_secret_key');
      const userId = decoded.id;
      console.log('User ID from token:', userId);

      const userDetails = await this.getUserDetails(userId);
      console.log('Detalles del usuario obtenidos:', userDetails);

      // Guardar los detalles del usuario
      this.userEmail = userDetails.email;
      this.userName = userDetails.name;

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
      console.error('Error decodificando el token:', error);
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
      // Utilizar los detalles almacenados en lugar de volver a solicitarlos
      if (this.userEmail && this.userName) {
        console.log('Detalles del usuario para enviar correo:', { email: this.userEmail, name: this.userName });

        // Lógica para enviar el correo electrónico al usuario
        await this.sendEmail(this.userEmail, this.userName);
      } else {
        console.error('No se encontraron los detalles del usuario almacenados.');
        throw new HttpException('Detalles del usuario no disponibles', HttpStatus.INTERNAL_SERVER_ERROR);
      }

      return true; // Indicar que la transacción fue autorizada
    } else {
      return false; // Indicar que la transacción no fue autorizada
    }
  }

  private async getUserDetails(userId: number): Promise<any> {
    return new Promise((resolve, reject) => {
      amqp.connect('amqp://localhost', (error0, connection) => {
        if (error0) {
          reject(error0);
          return;
        }

        connection.createChannel((error1, channel) => {
          if (error1) {
            reject(error1);
            return;
          }

          const queue = 'user_details_queue';
          const correlationId = this.generateUuid();

          channel.assertQueue('', { exclusive: true }, (error2, q) => {
            if (error2) {
              reject(error2);
              return;
            }

            channel.consume(
              q.queue,
              (msg) => {
                if (msg.properties.correlationId === correlationId) {
                  const userDetails = JSON.parse(msg.content.toString());
                  resolve(userDetails);
                  setTimeout(() => {
                    connection.close();
                  }, 500);
                }
              },
              { noAck: true },
            );

            channel.sendToQueue(queue, Buffer.from(JSON.stringify({ userId })), {
              correlationId,
              replyTo: q.queue,
            });
          });
        });
      });
    });
  }

  private generateUuid() {
    return Math.random().toString() + Math.random().toString() + Math.random().toString();
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

  private async sendEmail(email: string, name: string): Promise<void> {
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: 'NetDesignChile@gmail.com',
        pass: 'qnbr ypdy xupo kczi',
      },
    });

    const mailOptions = {
      from: 'NetDesignChile@gmail.com',
      to: email,
      subject: 'Compra exitosa',
      text: `Hola ${name},\n\nTu compra ha sido realizada con éxito. ¡Gracias por confiar en nosotros!\n\nSaludos,\nTu equipo.`,
    };

    try {
      await transporter.sendMail(mailOptions);
      console.log(`Correo enviado a ${email}`);
    } catch (error) {
      console.error('Error al enviar el correo:', error);
    }
  }
}
