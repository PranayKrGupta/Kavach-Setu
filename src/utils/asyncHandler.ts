import { Request, Response, NextFunction, RequestHandler } from 'express';

export type AsyncRequestHandler<TReq = Request, TRes = Response> = (
  req: TReq,
  res: TRes,
  next: NextFunction
) => Promise<unknown>;

/**
 * Higher-order function that wraps asynchronous Express route handlers
 * and routes any thrown errors to Express next(error) middleware.
 */
export const asyncHandler = <TReq extends Request = Request, TRes extends Response = Response>(
  fn: AsyncRequestHandler<TReq, TRes>
): RequestHandler => {
  return (req, res, next) => {
    Promise.resolve(fn(req as unknown as TReq, res as unknown as TRes, next)).catch(next);
  };
};
