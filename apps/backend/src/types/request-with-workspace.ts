import { Request } from 'express';

export interface RequestWithWorkspace extends Request {
  locals: {
    requestId: string;
    uploadDir: string;
    outputDir: string;
  };
}
