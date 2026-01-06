const express = require("express");
const router = express.Router();
const MediaController = require("../controllers/mediaController");

router.get("/info", MediaController.getInfo);
router.post("/convert", MediaController.convert);
router.get("/stream/:fileId", MediaController.stream);
router.get("/download/:fileId", MediaController.download);

module.exports = router;
