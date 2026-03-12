import { ArgumentsHost } from '@nestjs/common';
import { HttpException, HttpStatus } from '@nestjs/common';

import { AllExceptionsFilter } from './http-exception.filter';

describe('AllExceptionsFilter', () => {
  let filter: AllExceptionsFilter;

  const mockResponse = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  };

  const mockArgumentsHost = {
    switchToHttp: () => ({
      getResponse: () => mockResponse,
    }),
  } as unknown as ArgumentsHost;

  beforeEach(() => {
    jest.clearAllMocks();
    filter = new AllExceptionsFilter();
  });

  it('Should handle a standard HttpException', () => {
    const message = 'Test Error';
    const exception = new HttpException(message, HttpStatus.BAD_REQUEST);

    filter.catch(exception, mockArgumentsHost);

    expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
    expect(mockResponse.json).toHaveBeenCalledWith({
      success: false,
      statusCode: HttpStatus.BAD_REQUEST,
      message: message,
    });
  });

  it('Should handle Throttler errors by cleaning the message', () => {
    const exception = new HttpException('ThrottlerException: Too Many Requests', HttpStatus.TOO_MANY_REQUESTS);

    filter.catch(exception, mockArgumentsHost);

    expect(mockResponse.json).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Too Many Requests',
      }),
    );
  });

  it('Should handle an unknown error (500)', () => {
    const exception = new Error('Crash!');

    filter.catch(exception, mockArgumentsHost);

    expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(mockResponse.json).toHaveBeenCalledWith({
      success: false,
      statusCode: 500,
      message: 'Internal server error',
    });
  });

  it('Should handle validation errors (concatenating error messages)', () => {
    const validationErrors = ['email must be an email', 'name is too short'];
    const exception = new HttpException({ message: validationErrors }, HttpStatus.BAD_REQUEST);

    filter.catch(exception, mockArgumentsHost);

    expect(mockResponse.json).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'email must be an email, name is too short',
      }),
    );
  });

  it('Should handle a simple string error message', () => {
    const exception = new HttpException('Direct Error', HttpStatus.FORBIDDEN);

    filter.catch(exception, mockArgumentsHost);

    expect(mockResponse.json).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Direct Error',
      }),
    );
  });

  it('Should handle an object error where message is a string', () => {
    const exception = new HttpException({ message: 'Specific Error' }, HttpStatus.BAD_REQUEST);

    filter.catch(exception, mockArgumentsHost);

    expect(mockResponse.json).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Specific Error',
      }),
    );
  });
});
