import { diskStorage } from 'multer';
import { extname } from 'path';

export const multerConfig = {
  storage: diskStorage({
    destination: (req, file, cb) => {
      const isImage = file.mimetype.startsWith('image/');
      cb(null, isImage ? 'uploads/images' : 'uploads/files');
    },
    filename: (req, file, cb) => {
      const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
      cb(null, unique + extname(file.originalname));
    },
  }),
  limits: {
    fileSize: 25 * 1024 * 1024, // 25MB
  },
};
