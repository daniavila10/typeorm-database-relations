import { inject, injectable } from 'tsyringe';

import AppError from '@shared/errors/AppError';

import IProductsRepository from '@modules/products/repositories/IProductsRepository';
import ICustomersRepository from '@modules/customers/repositories/ICustomersRepository';
import Order from '../infra/typeorm/entities/Order';
import IOrdersRepository from '../repositories/IOrdersRepository';

interface IProduct {
  id: string;
  quantity: number;
}

interface IRequest {
  customer_id: string;
  products: IProduct[];
}

@injectable()
class CreateOrderService {
  constructor(
    @inject('OrdersRepository')
    private ordersRepository: IOrdersRepository,

    @inject('ProductsRepository')
    private productsRepository: IProductsRepository,

    @inject('CustomersRepository')
    private customersRepository: ICustomersRepository,
  ) {}

  public async execute({
    customer_id,
    products: productsRequest,
  }: IRequest): Promise<Order> {
    const customer = await this.customersRepository.findById(customer_id);

    if (!customer) {
      throw new AppError('Customer not exist');
    }

    const productsExist = await this.productsRepository.findAllById(
      productsRequest,
    );

    if (productsRequest.length !== productsExist.length) {
      throw new AppError('One or more products not exist');
    }

    productsRequest.map(product => {
      const productQuantity = productsExist.find(
        productDB => productDB.id === product.id,
      );

      if (!productQuantity || productQuantity.quantity < product.quantity) {
        throw new AppError(
          'One or more products has no quantity for this operation',
        );
      }

      return product;
    });

    const products = productsExist.map(product => {
      const productQuantity = productsRequest.find(
        productFind => productFind.id === product.id,
      );

      if (productQuantity) {
        return {
          product_id: product.id,
          price: product.price,
          quantity: productQuantity.quantity,
        };
      }

      return {
        product_id: product.id,
        price: product.price,
        quantity: product.quantity,
      };
    });

    const order = await this.ordersRepository.create({
      customer,
      products,
    });

    await this.productsRepository.updateQuantity(productsRequest);

    return order;
  }
}

export default CreateOrderService;
