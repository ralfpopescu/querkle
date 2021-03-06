"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAll = void 0;
const services_1 = require("../../../services");
exports.getAll = ({ pool, translator, }) => ({ entity }) => __awaiter(void 0, void 0, void 0, function* () {
    if (!entity) {
        throw new Error('entity was not provided for getAll operation.');
    }
    const queryString = `SELECT * FROM "${translator.objToRel(entity)}";`;
    // TODO: Fix types here.
    // @ts-ignore
    const response = yield services_1.query({ queryString, pool });
    return services_1.format(response, translator);
});
//# sourceMappingURL=index.js.map