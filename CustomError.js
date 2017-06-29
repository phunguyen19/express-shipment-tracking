var _util = require("util");

var CustomError = function (Message, Code, Detail) {
    return new _CustomError(Message, Code, Detail);
}
var _CustomError = function (Message, Code, Detail) {
    this.message = Message || "CustomError Message";

    this.IsCustomError = true;
    this.Code = Code || "";
    this.Detail = Detail || "";

    Error.captureStackTrace(this, CustomError);
}
_util.inherits(_CustomError, Error);

exports.CustomError =CustomError;