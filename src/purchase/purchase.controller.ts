import { Controller, Post, Body, Headers, HttpException, HttpStatus, Res } from '@nestjs/common';
import { PurchaseService, WebpayResponse } from './purchase.service';
import { Response } from 'express'; // Importar Response de express

@Controller('purchase')
export class PurchaseController {
  constructor(private readonly purchaseService: PurchaseService) {}

  @Post('init')
  async initTransaction(@Headers('authorization') authHeader: string, @Body('totalAmount') totalAmount: number): Promise<WebpayResponse> {
    try {
      const response = await this.purchaseService.initTransaction(authHeader, totalAmount);
      return response;
    } catch (error) {
      throw new HttpException(error.message, error.status || HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Post('return')
  async returnTransaction(@Body('token_ws') token: string, @Body('userId') userId: string, @Res() res: Response) {
    try {
      const isAuthorized = await this.purchaseService.returnTransaction(token, userId);

      if (isAuthorized) {
        // Aquí puedes implementar la lógica para enviar correo con nodemailer y usar RabbitMQ

        // Ejemplo de redirección después de procesar la lógica
        res.redirect('http://localhost:3000/purchase-success');
      } else {
        res.redirect('http://localhost:3000/purchase-failure');
      }
    } catch (error) {
      console.error('Error procesando la transacción:', error);
      res.redirect('http://localhost:3000/purchase-failure');
    }
  }
}
