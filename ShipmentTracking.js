"use strict";
var _q = require("q");
var _request = require("request");
var _express = require('express');
var _tracker = _express();
var _CustomError = require("./CustomError.js").CustomError;
var _fs = require('fs');

var ErrorCodes = {
	ERROR_INVALID_FORMAT: -1,
	ERROR_REQUEST: -2,
	ERROR_RESPONSE: -3,
	ERROR_BODY: -4,
	ERROR_NOT_FOUND: -5,
};

var ShipmentTracking = function (Options) {
	var this_ = this;

	this_.Options = Options || {};
	if (!this_.Options.Debug) {
		this_.Options.Debug = {
			DHL: false,
			FedEx: false,
			TNT: false,
			UPS: false,
			ViettelPost: false,
			VNPost: false,
			Skyworldex: false,
			Skydart: false,
			WCE: false,
			CPQT: false,
			//Fardar: false,
			ASL: false,
			Global_Vietnam: false,
			TDK: false,
			Post247: false,
			VietAn: false,
			SaoViet: false,
		};
	}

	this_.Jar = _request.jar();
	this_.Request = _request.defaults(
		{
			strictSSL: false,
			followRedirect: false,
			jar: this_.Jar,
			headers: {
				"User-Agent": "Mozilla/5.0 (Windows NT 6.3; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/46.0.2490.71 Safari/537.36",
			},
		}
	);

	this_.Result = [];
};

var running = function (Airlines, Code) {
	//console.log("Running: " + Airlines + " - " + Code);
};
var addInfo = function (Bill, Destination, Signature, Time, Result) {
	var Info = {};
	
	if (Bill)        {Info.bill_number = Bill;}        else {Info.bill_number = "......";}
	if (Destination) {Info.destination = Destination;} else {Info.destination = "......";}
	if (Signature)   {Info.signature   = Signature;}   else {Info.signature   = "......";}
	if (Time)        {Info.time        = Time;}        else {Info.time        = "......";}
	
	Result.splice(0, 0, Info);
};
var logResultStatus = function (AirLines, Code, Status) {
	var date = new Date(),
		day = date.getDate(),
		month = date.getMonth()+1,
		hours = date.getHours(),
		minutes = date.getMinutes(),
		seconds = date.getSeconds();
		
	if (day < 10) {day = "0" + day;}
	if (month < 10) {month = "0" + month;}
	if (hours < 10) {hours = "0" + hours;}
	if (minutes < 10) {minutes = "0" + minutes;}
	if (seconds < 10) {seconds = "0" + seconds;}
		
	var check_Time = day + "/" + month + "-" + hours + ":" + minutes + ":" + seconds;
	console.log(check_Time + " " + "ShipmentTracking." + AirLines + " - " + Code + " - getDataStaCode: " + Status);
};

ShipmentTracking.prototype.DHL = function (Code) {
	var this_;
	this_ = this;
	var Defer = _q.defer();
	var URL = "http://www.dhl.com/shipmentTracking?AWB=";

	Code = typeof Code === "string" ? Code.replace(/\s+/g, '') : "";

	if (!Code || !Code.match(/^\d{10}$/g)) {
		Defer.reject(
			_CustomError(
				"ShipmentTracking.DHL",
				ErrorCodes.ERROR_INVALID_FORMAT,
				Code
			)
		);

		return Defer.promise;
	}

	running ("DHL", Code);
	
	this_.Request.get(
		{
			url: URL + Code,
		},
		function (Error_, Response, Body) {
			
			if (Error_) {
				return Defer.reject(
					_CustomError(
						"ShipmentTracking.DHL",
						ErrorCodes.ERROR_REQUEST,
						Error_
					)
				);
			}

			if (Response.statusCode !== 200) {
				return Defer.reject(
					_CustomError(
						"ShipmentTracking.DHL",
						ErrorCodes.ERROR_RESPONSE,
						Response
					)
				);
			}
			
			var PatternStrip = /[\s]{2,}/g;
			var Body_ = null;
			var Record = null, Record_ = null, Info_ = null;
			var Index = 0;
			
			Body_ = JSON.parse(Body);

			if (
				!Body_ || !Body_.results || !Body_.results[0] || !Body_.results[0].checkpoints
			) {
				return Defer.reject(
					_CustomError(
						"ShipmentTracking.DHL",
						ErrorCodes.ERROR_BODY,
						Body
					)
				);
			}

			Body = Body_.results[0].checkpoints;

			for (Index = 0; Index < Body.length; Index++) {
				Record = Body[Index];

				Record_ = {};
				Record_.date = Record.date.replace(PatternStrip, " ");
				Record_.time = Record.time.replace(PatternStrip, " ");
				Record_.location = Record.location;
				Record_.description = Record.description.replace(PatternStrip, " ");

				this_.Result.push(Record_);
			}

			if (!this_.Result.length) {
				return Defer.reject(
					_CustomError(
						"ShipmentTracking.DHL",
						ErrorCodes.ERROR_NOT_FOUND
					)
				);
			}
			
			Info_ = Body_.results[0];
			
			if (Info_) {
				addInfo (
					Code, 
					Info_.destination.value, 
					Info_.signature.signatory, 
					Info_.signature.description, 
					this_.Result
				);
			} else {
				addInfo (Code, null, null, null, this_.Result);
			}
			
			logResultStatus ("DHL", Code, Response.statusCode);
			
			return Defer.resolve([this_]);
		}
	);
	
	return Defer.promise;
};

ShipmentTracking.prototype.FedEx = function (Code) {
	var this_ = this;
	var Defer = _q.defer();
	var URL = "https://www.fedex.com/trackingCal/track";

	if (typeof Code === "string") {
		Code = Code.replace(/\s+/g, '');
	} else {
		Code = "";
	}

	if (!Code || !Code.match(/^\d{12}$/g)) {
		Defer.reject(
			_CustomError(
				"ShipmentTracking.FedEx",
				ErrorCodes.ERROR_INVALID_FORMAT,
				Code
			)
		);

		return Defer.promise;
	}
	
	running ("FedEx", Code);
	
	this_.Request.post(
		{
			url: URL,
			form: {
				data: JSON.stringify(
					{
						TrackPackagesRequest: {
							appType: "WTRK",
							uniqueKey: "",
							processingParameters: {},
							trackingInfoList: [
								{
									trackNumberInfo: {
										trackingNumber: Code,
										trackingQualifier: "",
										trackingCarrier: "",
									},
								},
							],
						},
					}
				),
				action: "trackpackages",
				locale: "en_VN",
				version: 1,
				format: "json",
			},
		},
		function (Error_, Response, Body) {

			if (Error_) {
				return Defer.reject(
					_CustomError(
						"ShipmentTracking.FedEx",
						ErrorCodes.ERROR_REQUEST,
						Error_
					)
				);
			}

			if (Response.statusCode !== 200) {
				return Defer.reject(
					_CustomError(
						"ShipmentTracking.FedEx",
						ErrorCodes.ERROR_RESPONSE,
						Response
					)
				);
			}

			var PatternStrip = /[\s]{2,}/g;
			var Body_ = null;
			var Record = null, Record_ = null, Info_ = null;
			var Index = 0;
			
			Body_ = JSON.parse(Body);

			if (
				!Body_
				|| !Body_.TrackPackagesResponse
				|| !Body_.TrackPackagesResponse.packageList
				|| !Body_.TrackPackagesResponse.packageList[0]
				|| !Body_.TrackPackagesResponse.packageList[0].scanEventList
			) {
				return Defer.reject(
					_CustomError(
						"ShipmentTracking.FedEx",
						ErrorCodes.ERROR_BODY,
						Body
					)
				);
			}
				
			Body = Body_.TrackPackagesResponse.packageList[0].scanEventList;

			for (Index = 0; Index < Body.length; Index++) {
				Record = Body[Index];

				if (!Record.date || !Record.time) {
					continue;
				}

				Record_ = {};
				Record_.date = Record.date.replace(PatternStrip, " ");
				Record_.time = Record.time.replace(PatternStrip, " ");
				Record_.location = Record.scanLocation.replace(PatternStrip, " ");
				Record_.description = Record.status.replace(PatternStrip, " ");

				this_.Result.push(Record_);
			}

			if (!this_.Result.length) {
				return Defer.reject(
					_CustomError(
						"ShipmentTracking.FedEx",
						ErrorCodes.ERROR_NOT_FOUND
					)
				);
			}
			
			
			Info_ = Body_.TrackPackagesResponse.packageList[0];
			
			if (Info_) {
				var time_ = /Delivered([^]*?)Signed/gi.exec(Info_.statusWithDetails);
				if (time_) {time_ = time_[1];} else {time_ = null;}
				addInfo (Code, Info_.destLocationCity, Info_.receivedByNm, time_, this_.Result);
			} else {
				addInfo (Code, null, null, null, this_.Result);
			}
		
			logResultStatus ("FedEx", Code, Response.statusCode);
			
			return Defer.resolve([this_]);
		}
	);

	return Defer.promise;
};

ShipmentTracking.prototype.TNT = function (Code) {
	var this_ = this;
	var Defer = _q.defer();
	var URL = "http://www.tnt.com/webtracker/tracking.do?searchType=CON&cons=";
	
	if (typeof Code === "string") {
		Code = Code.replace(/\s|\D/g, '');
	} else {
		Code = "";
	}

	if (!Code || !Code.match(/^\d{9}$/g)) {
		Defer.reject(
			_CustomError(
				"ShipmentTracking.TNT",
				ErrorCodes.ERROR_INVALID_FORMAT,
				Code
			)
		);

		return Defer.promise;
	}
	
	running ("TNT", Code);
	
	this_.Request.get(
		{
			url: URL + Code,
		},
		function (Error_, Response, Body) {
			var Pattern = /<tr vAlign="top"><td noWrap="true">(.+?)<\/td><td>(.+?)<\/td><td>(.+?)<\/td><td>(.+?)<\/td>/gi;
			var PatternStrip = /[\s]{2,}/g;
			var Record = null, Record_ = null;

			if (Error_) {
				return Defer.reject(
					_CustomError(
						"ShipmentTracking.TNT",
						ErrorCodes.ERROR_REQUEST,
						Error_
					)
				);
			}

			if (Response.statusCode !== 200) {
				return Defer.reject(
					_CustomError(
						"ShipmentTracking.TNT",
						ErrorCodes.ERROR_RESPONSE,
						Response
					)
				);
			}
				
			do {
				Record = Pattern.exec(Body);
				if (Record) {
					Record_ = {};
					Record_.date = Record[1].replace(PatternStrip, " ");
					Record_.time = Record[2].replace(PatternStrip, " ");
					Record_.location = Record[3].replace(PatternStrip, " ");
					Record_.description = Record[4].replace(PatternStrip, " ");

					this_.Result.push(Record_);
				}
			} while (Record);

			if (!this_.Result.length) {
				return Defer.reject(
					_CustomError(
						"ShipmentTracking.TNT",
						ErrorCodes.ERROR_NOT_FOUND
					)
				);
			}
			
			var TNT_InfoRegEx = /Destination[^]*?<B>([^]*?)\s*<\/[^]*?Delivery date[^]*?[^]*?<B>([^]*?)\s*<\/[^]*?Signatory[^]*?<B>([^]*?)\s*<\/[^]*?/g;
			
			var Info_ = TNT_InfoRegEx.exec(Body);
			
			if (Info_) {
				addInfo (Code, Info_[1], Info_[3], Info_[2], this_.Result);
			} else {
				addInfo (Code, null, null, null, this_.Result);
			}
			
			logResultStatus ("TNT", Code, Response.statusCode);
			
			return Defer.resolve([this_]);
		}
	);

	return Defer.promise;
};

ShipmentTracking.prototype.UPS_Track = function (Code) {
	var this_ = this;
	var Defer = _q.defer();
	var URL = "https://wwwapps.ups.com/WebTracking/track?loc=en_VN";
	var Form = "loc=en_VN&tbifl=1&hiddenText=&tracknum=" + Code + "&track.x=Track&trackSelectedOption=";
	
	console.log("ShipmentTracking.UPS_Track - " + Code);
	
	this_.Request.post(
		{
			url: URL,
			form: Form
		},
		function (Error_, Response, Body) {
			var PatternForm = /detailFormid" action="(.+?)"([^]+?)<\/form>/gi;
			var PatternSession = /HIDDEN_FIELD_SESSION.+?value="(.*?)"/gi;
			var PatternFields = /type="hidden" name="(.+?)" value="(.*?)"/gi;
			var Form = null, Action = null, Session = null;
			var Field = null, Fields = {};

			if (Error_) {
				return Defer.reject(
					_CustomError(
						"ShipmentTracking.UPS_Track",
						ErrorCodes.ERROR_REQUEST,
						Error_
					)
				);
			}

			if (Response.statusCode !== 200) {
				return Defer.reject(
					_CustomError(
						"ShipmentTracking.UPS_Track",
						ErrorCodes.ERROR_RESPONSE,
						Response
					)
				);
			}

			Form = PatternForm.exec(Body);
			if (!Form || !Form[0] || !Form[1]) {
				return Defer.reject(
					_CustomError(
						"ShipmentTracking.UPS_Track",
						ErrorCodes.ERROR_BODY,
						Body
					)
				);
			}

			Action = Form[1];
			Form = Form[0];

			Session = PatternSession.exec(Form);
			if (!Session) {
				return Defer.reject(
					_CustomError(
						"ShipmentTracking.UPS_Track",
						ErrorCodes.ERROR_BODY,
						Form
					)
				);
			}

			Session = Session[1];

			Fields.HIDDEN_FIELD_SESSION = Session;

			do {
				Field = PatternFields.exec(Form);
				if (Field) {
					Fields[Field[1]] = Field[2];
				}
			} while (Field);

			Fields.showSpPkgProg1 = "true";

			this_.Result.push(Action);
			this_.Result.push(Fields);

			return Defer.resolve([this_]);
		}
	);

	return Defer.promise;
};

ShipmentTracking.prototype.UPS = function (Code) {
	var this_ = this;
	var Defer = _q.defer();

	if (typeof Code === "string") {
		Code = Code.replace(/\s+/g, '');
	} else {
		Code = "";
	}

	if (!Code || !Code.match(/^[a-zA-Z\d]{18}$/g)) {
		Defer.reject(
			_CustomError(
				"ShipmentTracking.UPS",
				ErrorCodes.ERROR_INVALID_FORMAT,
				Code
			)
		);

		return Defer.promise;
	}
	
	running ("UPS", Code);
	
	this_.UPS_Track(Code).spread(
		function (ShipmentTracking) {
			var URL = ShipmentTracking.Result[0];
			var Form = ShipmentTracking.Result[1];

			ShipmentTracking.Result = [];

			ShipmentTracking.Request.post(
				{
					url: URL,
					form: Form,
				},
				function (Error_, Response, Body) {
					var Pattern = /<td class="nowrap">([^]+?)<\/td>\s+<td class="nowrap">([^]+?)<\/td>\s+<td class="nowrap">([^]+?)<\/td>\s+<td>([^]+?)<\/td>/gi;
					var PatternStrip = /[\s]{2,}/g;
					var Record = null, Record_ = null;

					if (Error_) {
						return Defer.reject(
							_CustomError(
								"ShipmentTracking.UPS",
								ErrorCodes.ERROR_REQUEST,
								Error_
							)
						);
					}

					if (Response.statusCode !== 200) {
						return Defer.reject(
							_CustomError(
								"ShipmentTracking.UPS",
								ErrorCodes.ERROR_RESPONSE,
								Response
							)
						);
					}

					do {
						Record = Pattern.exec(Body);

						if (Record) {
							Record_ = {};
							Record_.date = Record[2].replace(PatternStrip, " ");
							Record_.time = Record[3].replace(PatternStrip, " ");
							Record_.location = Record[1].replace(PatternStrip, " ");
							Record_.description = Record[4].replace(PatternStrip, " ");

							this_.Result.push(Record_);
						}
					} while (Record);

					if (!this_.Result.length) {
						return Defer.reject(
							_CustomError(
								"ShipmentTracking.UPS",
								ErrorCodes.ERROR_NOT_FOUND
							)
						);
					}
					
					addInfo (Code, null, null, null, this_.Result);
					
					logResultStatus ("UPS", Code, Response.statusCode);
					return Defer.resolve([this_]);
				}
			);
		}
	).fail(
		function (Error_) {
			return Defer.reject(Error_);
		}
	);

	return Defer.promise;
};

ShipmentTracking.prototype.ViettelPost = function (Code) {
	var this_ = this;
	var Defer = _q.defer();
	var URL = "http://www.viettelpost.com.vn/Default.aspx?tabid=208&id=";

	if (typeof Code === "string") {
		Code = Code.replace(/\s+|\*/g, '');
	} else {
		Code = "";
	}

	if (!Code || !Code.match(/^\d{10}$/g)) {
		Defer.reject(
			_CustomError(
				"ShipmentTracking.ViettelPost",
				ErrorCodes.ERROR_INVALID_FORMAT,
				Code
			)
		);

		return Defer.promise;
	}
	
	running ("ViettelPost", Code);
	
	this_.Request.get(
		{
			url: URL + Code,
		},
		function (Error_, Response, Body) {
			var Pattern = /BUU_CUC">(.+?)<\/span[^]+?TRANG_THAI">(.+?)<\/span[^]+?THOI_GIAN">(.+?)<\/span[^]+?GHI_CHU">(.+?)<\/span/gi;
			var PatternStrip = /[\s]{2,}/g;
			var Record = null, Record_ = null;
			var DateTime = null;

			if (Error_) {
				return Defer.reject(
					_CustomError(
						"ShipmentTracking.ViettelPost",
						ErrorCodes.ERROR_REQUEST,
						Error_
					)
				);
			}

			if (Response.statusCode !== 200) {
				return Defer.reject(
					_CustomError(
						"ShipmentTracking.ViettelPost",
						ErrorCodes.ERROR_RESPONSE,
						Response
					)
				);
			}
			
			do {
				Record = Pattern.exec(Body);
				if (Record) {
					if (Record[3] === "NULL") {
						continue;
					}

					DateTime = Record[3].split(" ");

					Record_ = {};
					Record_.date = DateTime[1].replace(PatternStrip, " ");
					Record_.time = DateTime[0].replace(PatternStrip, " ");
					Record_.location = Record[1].replace(PatternStrip, " ");
					Record_.description = Record[2].replace(PatternStrip, " ");

					this_.Result.push(Record_);
				}
			} while (Record);

			if (!this_.Result.length) {
				return Defer.reject(
					_CustomError(
						"ShipmentTracking.ViettelPost",
						ErrorCodes.ERROR_NOT_FOUND
					)
				);
			}

			
			var ViettelPost_InfoRegex = /NOI_PHAT">([^]*?)<\/[^]*?NGUOI_NHAN">([^]*?)<\/[^]*?NGAY_GIAO_HANG[^]*?">([^]*?)<\/span/g;
			
			var Info_ = ViettelPost_InfoRegex.exec(Body);
			
			if (Info_) {
				addInfo (Code, Info_[1], Info_[2], Info_[3], this_.Result);
			} else {
				addInfo (Code, null, null, null, this_.Result);
			}
			
			logResultStatus ("ViettelPost", Code, Response.statusCode);
			
			return Defer.resolve([this_]);
		}
	);
	
	return Defer.promise;
};

ShipmentTracking.prototype.VNPost = function (Code) {
	var this_ = this;
	var Defer = _q.defer();
	//var URL = "http://www.vnpost.vn/TrackandTrace/tabid/130/n/";
	var URL = "http://www.vnpost.vn/vi-vn/dinh-vi/buu-pham?key=";
	if (typeof Code === "string") {
		Code = Code.replace(/\s+/g, '');
	} else {
		Code = "";
	}

	if (!Code || !Code.match(/^[a-zA-Z\d]{13}$/g)) {
		Defer.reject(
			_CustomError(
				"ShipmentTracking.VNPost",
				ErrorCodes.ERROR_INVALID_FORMAT,
				Code
			)
		);

		return Defer.promise;
	}
	
	running ("VNPost", Code);
	
	this_.Request.get(
		{
			url: URL + encodeURI(Code.trim()),// + "/t/0/s/1/Default.aspx",
		},
		function (Error_, Response, Body) {
			var Pattern = /center">(.+?)<\/td.+?center">(.+?)<\/td><td>(.+?)<\/td><td>(.+?)<\/td.+?/gi;
			var PatternStrip = /[\s]{2,}/g;
			var Record = null, Record_ = null;
			console.log(Response.statusCode);
			
			if (Error_) {
				return Defer.reject(
					_CustomError(
						"ShipmentTracking.VNPost",
						ErrorCodes.ERROR_REQUEST,
						Error_
					)
				);
			}

			if (Response.statusCode !== 200) {
				return Defer.reject(
					_CustomError(
						"ShipmentTracking.VNPost",
						ErrorCodes.ERROR_RESPONSE,
						Response
					)
				);
			}
			
			do {
				Record = Pattern.exec(Body);
				if (Record) {
					Record_ = {};
					Record_.date = Record[1].replace(PatternStrip, " ");
					Record_.time = Record[2].replace(PatternStrip, " ");
					Record_.location = Record[4].replace(PatternStrip, " ");
					Record_.description = Record[3].replace(PatternStrip, " ");

					this_.Result.push(Record_);
				}
			} while (Record);
						
			if (!this_.Result.length) {
				return Defer.reject(
					_CustomError(
						"ShipmentTracking.VNPost",
						ErrorCodes.ERROR_NOT_FOUND
					)
				);
			}
			
			var VNPost_InfoRegex = /Thông tin phát[^]*?center">([^]*?)<\/td>[^]*?<td>([^]*?)<\/td>[^]*?Người nhận:(\w+)/gi;
			var Info_ = VNPost_InfoRegex.exec(Body);
			if (Info_) {
				addInfo (Code, Info_[2], Info_[3], Info_[1], this_.Result);
			} else {
				addInfo (Code, null, null, null, this_.Result);
			}
			Record = this_.Result[this_.Result.length - 1].location;
			Record_ = this_.Result[this_.Result.length - 1].description;

			this_.Result[this_.Result.length - 1].location = Record_;
			this_.Result[this_.Result.length - 1].description = Record;
			
			logResultStatus ("VNPost", Code, Response.statusCode);
			
			return Defer.resolve([this_]);
		}
	);

	return Defer.promise;
};

ShipmentTracking.prototype.Skyworldex = function (Code) {
	var this_ = this;
	var Defer = _q.defer();
	var URL = "http://www.skyworldex.com/Page/TrackingResult.aspx?c=";

	if (typeof Code === "string") {
		Code = Code.replace(/\s+/g, '');
	} else {
		Code = "";
	}

	if (!Code || !Code.match(/^\d{10}$/g)) {
		Defer.reject(
			_CustomError(
				"ShipmentTracking.Skyworldex",
				ErrorCodes.ERROR_INVALID_FORMAT,
				Code
			)
		);

		return Defer.promise;
	}
	
	running ("Skyworldex", Code);
	
	this_.Request.get(
		{
			url: URL + Code,
		},
		function (Error_, Response, Body) {
			var Pattern = /lblTime">(.+?)<\/span[^]+?lblDate">(.+?)<\/span[^]+?<\/td><td>(.+?)<\/td><td>(.+?)<\/td>/gi;
			var PatternStrip = /[\s]{2,}/g;
			var Record = null, Record_ = null;

			if (Error_) {
				return Defer.reject(
					_CustomError(
						"ShipmentTracking.Skyworldex",
						ErrorCodes.ERROR_REQUEST,
						Error_
					)
				);
			}

			if (Response.statusCode !== 200) {
				return Defer.reject(
					_CustomError(
						"ShipmentTracking.Skyworldex",
						ErrorCodes.ERROR_RESPONSE,
						Response
					)
				);
			}
			
			do {
				Record = Pattern.exec(Body);
				if (Record) {
					Record_ = {};
					Record_.date = Record[2].replace(PatternStrip, " ");
					Record_.time = Record[1].replace(PatternStrip, " ");
					Record_.location = Record[3].replace(PatternStrip, " ");
					Record_.description = Record[4].replace(PatternStrip, " ");

					this_.Result.push(Record_);
				}
			} while (Record);

			if (!this_.Result.length) {
				return Defer.reject(
					_CustomError(
						"ShipmentTracking.Skyworldex",
						ErrorCodes.ERROR_NOT_FOUND
					)
				);
			}

			
			var Skyworldex_Info_regex = /ToLocation">([^]*?)<[^]*?DeliveredOn">([^]*?)<[^]*?SignedBy">([^]*?)</gi;
			
			var Info_ = Skyworldex_Info_regex.exec(Body);
			
			if (Info_) {
				addInfo (Code, Info_[1], Info_[3], Info_[2], this_.Result);
			} else {
				addInfo (Code, null, null, null, this_.Result);
			}
			
			logResultStatus ("Skyworldex", Code, Response.statusCode);
			
			return Defer.resolve([this_]);
		}
	);
	
	return Defer.promise;
};

ShipmentTracking.prototype.Skydart = function (Code) {
	var this_ = this;
	var Defer = _q.defer();
	var URL = "http://www.skydart.com.vn/trackingdetail.aspx?id=";

	if (typeof Code === "string") {
		Code = Code.replace(/\s+/g, '');
	} else {
		Code = "";
	}

	if (!Code || !Code.match(/^[a-zA-Z]{3}\d{9}$/g)) {
		Defer.reject(
			_CustomError(
				"ShipmentTracking.Skydart",
				ErrorCodes.ERROR_INVALID_FORMAT,
				Code
			)
		);

		return Defer.promise;
	}
	
	running ("Skydart", Code);
	
	this_.Request.get(
		{
			url: URL + Code,
		},
		function (Error_, Response, Body) {
			var Pattern = /<td class="text-center">([^]+?)<\/td>[^]+?<td class="text-center">([^]+?)<\/td>[^]+?<td class="text-center">([^]+?)<\/td>[^]+?<td class="text-left">([^]+?)<\/td>/gi;
			var PatternStrip = /[\s]{2,}/g;
			var Record = null, Record_ = null;

			if (Error_) {
				return Defer.reject(
					_CustomError(
						"ShipmentTracking.Skydart",
						ErrorCodes.ERROR_REQUEST,
						Error_
					)
				);
			}

			if (Response.statusCode !== 200) {
				return Defer.reject(
					_CustomError(
						"ShipmentTracking.Skydart",
						ErrorCodes.ERROR_RESPONSE,
						Response
					)
				);
			}
			
			do {
				Record = Pattern.exec(Body);		
			
				if (Record) {
					
					Record_ = {};
					Record_.date = Record[1].replace(PatternStrip, " ");
					Record_.time = Record[2].replace(PatternStrip, " ");
					Record_.location = Record[3].replace(PatternStrip, " ");
					Record_.description = Record[4].replace(PatternStrip, " ");

					this_.Result.push(Record_);
				}
			} while (Record);
			
			if (!this_.Result.length) {
				return Defer.reject(
					_CustomError(
						"ShipmentTracking.Skydart",
						ErrorCodes.ERROR_NOT_FOUND
					)
				);
			}
			
			var Skydart_Info_regex = /delivered[^]*?FOR BY:\s+([^]*?) SHIPMENT DELIVERED ([^]*?)\s+<[^]*?\$txtTo[^]*?value="([^]*?)"/gi;
			var Info_ = Skydart_Info_regex.exec(Body);
			
			if (Info_) {
				addInfo (Code, Info_[3], Info_[1], Info_[2], this_.Result);
			} else {
				addInfo (Code, null, null, null, this_.Result);
			}
			
			logResultStatus ("Skydart", Code, Response.statusCode);
			
			return Defer.resolve([this_]);
		}
	);

	return Defer.promise;
};

ShipmentTracking.prototype.WCE = function (Code) {
	var this_ = this;
	var Defer = _q.defer();
	var URL = "http://wce.vn/tracking/TrackingView.aspx?SVD=" + Code;

	if (typeof Code === "string") {
		Code = Code.replace(/\s+/g, '');
	} else {
		Code = "";
	}

	if (!Code || !Code.match(/^\d{9}$/g)) {
		Defer.reject(
			_CustomError(
				"ShipmentTracking.WCE",
				ErrorCodes.ERROR_INVALID_FORMAT,
				Code
			)
		);

		return Defer.promise;
	}
	
	running ("WCE", Code);
	
	this_.Request.get(
		{
			url: URL,
		},
		function (Error_, Response, Body) {
			
			if (Error_) {
				return Defer.reject(
					_CustomError(
						"ShipmentTracking.WCE",
						ErrorCodes.ERROR_REQUEST,
						Error_
					)
				);
			}

			if (Response.statusCode !== 200) {
				return Defer.reject(
					_CustomError(
						"ShipmentTracking.WCE",
						ErrorCodes.ERROR_RESPONSE,
						Response
					)
				);
			}
			
			var Pattern = /nowrap;">([^]*?)<\/td[^]*?nowrap;">([^]*?)<\/td[^]*?300px;">\s*([^]*?)<\/td>[^]*?uppercase">([^]*?)<\/td?>/gi;
			var Info_Pattern = /Destination[^]*?lbStation">([^]*?)<[^]*?DateTime">([^]*?)<[^]*?capitalize;">\s*([^]*?)</gi;
			var Record = null, Record_ = null, Info_ = null;
			
			do {
				Record = Pattern.exec(Body);
				if (Record) {
					Record_ = {};
					Record_.date = Record[1];
					Record_.time = Record[2];
					Record_.location = Record[3];
					Record_.description = Record[4];

					this_.Result.splice(0, 0, Record_);

				}
			} while (Record);
			
			if (!this_.Result.length) {
						
				return Defer.reject(
					_CustomError(
						"ShipmentTracking.WCE",
						ErrorCodes.ERROR_NOT_FOUND
					)
				);
			}
			
			Info_ = Info_Pattern.exec(Body);
			
			if (Info_) {
				addInfo (Code, Info_[1], Info_[3], Info_[2], this_.Result);
			} else {
				addInfo (Code, null, null, null, this_.Result);
			}
			
			logResultStatus ("WCE", Code, Response.statusCode);
			
			return Defer.resolve([this_]);
		}
	);

	return Defer.promise;
};

ShipmentTracking.prototype.CPQT = function (Code) {
	var this_ = this;
	var Defer = _q.defer();
	var URL = "http://chuyenphatquocte.com/component/lading/" + Code + ".html";

	if (typeof Code === "string") {
		Code = Code.replace(/\s+/g, '');
	} else {
		Code = "";
	}
	
	if (!Code || !Code.toString().match(/^\d{6}$/g)) {
		Defer.reject(
			_CustomError(
				"ShipmentTracking.CPQT",
				ErrorCodes.ERROR_INVALID_FORMAT,
				Code
			)
		);

		return Defer.promise;
	}
	
	running ("CPQT", Code);
	
	this_.Request.get(
		{
			url: URL,
		},
		function (Error_, Response, Body) {
			
			if (Error_) {
				return Defer.reject(
					_CustomError(
						"ShipmentTracking.CPQT",
						ErrorCodes.ERROR_REQUEST,
						Error_
					)
				);
			}

			if (Response.statusCode !== 200) {
				return Defer.reject(
					_CustomError(
						"ShipmentTracking.CPQT",
						ErrorCodes.ERROR_RESPONSE,
						Response
					)
				);
			}
			
			var classifyPattern = /align="top">Chi tiết[^]*?<td style="width:\s*(\d+)/gi,
				classifyArray = classifyPattern.exec(Body);
			
			if (!classifyArray){
				return Defer.reject(
					_CustomError(
						"ShipmentTracking.CPQT",
						"",
						""
					)
				);
			}
			
			var Pattern, PatternStrip;
			
			switch (classifyArray[1]){
				case "80":
					Pattern = /80px[^]*?<p>\s*([^]*?)<\/p>[^]*?<p>\s*([^]*?)<\/p>[^]*?<td[^]*?>\s*([^]*?)<\//gi;
					PatternStrip = "";
					break;
				case "88":
					Pattern = /88px;">[^]*?<p>\s+([^]*?)[\s]([^]*?)<\/p[^]*?282px[^]*?<p>\s+([^]*?)<\//gi;
					PatternStrip = /[^]*\w+px[^]*;[^]*?|">/gi;
					break;
			}
			
			var Record = null, Record_ = null;
			
			do {
				Record = Pattern.exec(Body);
				if (Record) {
					Record_ = {};
						Record_.date = Record[1];
						Record_.time = Record[2].replace(PatternStrip, "");
						Record_.location = "";
						Record_.description = Record[3].replace(/(<[^]*?>|\r|\n|\t)/gi, " ").replace(/\s+/gi, " ");
					
					this_.Result.splice(0, 0, Record_);
					
				}
			} while (Record);
			
			
			
			if (!this_.Result.length) {
	
				return Defer.reject(
					_CustomError(
						"ShipmentTracking.CPQT",
						ErrorCodes.ERROR_NOT_FOUND
					)
				);
			}

			addInfo (Code, null, null, null, this_.Result);
			
			logResultStatus ("CPQT", Code, Response.statusCode);
			
			return Defer.resolve([this_]);
		}
	);

	return Defer.promise;
};
/*
ShipmentTracking.prototype.Fardar = function (Code) {
	var this_ = this;
	var Defer = _q.defer();
	var URL = "http://61.145.165.207:8091/websearch/podsearch.asp";
	var Form = "AWBNo=" + Code + "&t_03.x=20&t_03.y=16";

	if (typeof Code === "string") {
		Code = Code.replace(/\s+/g, '');
	} else {
		Code = "";
	}
	
	if (!Code || !Code.match(/^\d{10}$/g)) {
		Defer.reject(
			_CustomError(
				"ShipmentTracking.Fardar",
				ErrorCodes.ERROR_INVALID_FORMAT,
				Code
			)
		);

		return Defer.promise;
	}
	
	running ("Fardar", Code);
	
	this_.Request.post(
		{
			url: URL,
			form: Form
		},
		function (Error_, Response, Body) {
			var Pattern = /align=left>[^]*?2">([^]*?)(..:..:..)<\/font[^]*?[^]*?2">([^]*?)<\/font[^]*?[^]*?[^]*?2">([^]*?)<\/font[^]*?<\/tr>/gi;
			
			do {
				Record = Pattern.exec(Body);
				if (Record) {
					Record_ = {};
						Record_.date = Record[1];
						Record_.time = Record[2];
						Record_.location = Record[3];
						Record_.description = Record[4].replace(/[^]*?<s([^]*)Signature/gi, "Signature");
					
					this_.Result.splice(0, 0, Record_);
					
				}
			} while (Record);
						
			if (!this_.Result.length) {
	
				return Defer.reject(
					_CustomError(
						"ShipmentTracking.Fardar",
						ErrorCodes.ERROR_NOT_FOUND
					)
				);
			}
			
			addInfo (Code, null, null, null, this_.Result);
			
			logResultStatus ("Fardar", Code, Response.statusCode);
			
			return Defer.resolve([this_]);
		}
	);

	return Defer.promise;
};
*/
ShipmentTracking.prototype.ASL = function (Code) {
	var this_ = this;
	var Defer = _q.defer();
	var URL = "http://asl.vn/index.php?option=com_donhang&view=donhang";
	var Form = "madonhang=" + Code + "&track.x=Tra+c%E1%BB%A9u";

	if (typeof Code === "string") {
		Code = Code.replace(/\s+/g, '');
	} else {
		Code = "";
	}
	
	if (!Code || !Code.toString().match(/^\d{7}$/g)) {
		Defer.reject(
			_CustomError(
				"ShipmentTracking.ASL",
				ErrorCodes.ERROR_INVALID_FORMAT,
				Code
			)
		);

		return Defer.promise;
	}
	
	running ("ASL", Code);
	
	this_.Request.post(
		{
			url: URL,
			form: Form
		},
		function (Error_, Response, Body) {
			
			if (Error_) {
				return Defer.reject(
					_CustomError(
						"ShipmentTracking.ASL",
						ErrorCodes.ERROR_REQUEST,
						Error_
					)
				);
			}

			if (Response.statusCode !== 200) {
				return Defer.reject(
					_CustomError(
						"ShipmentTracking.ASL",
						ErrorCodes.ERROR_RESPONSE,
						Response
					)
				);
			}
			
			var Pattern = /colspan="5">[^]*?scope="col">\s*([^]*?)\s*<([^]*?)<thead/gi;
			var Record_Group = null;	
			var RecordPattern = null;
			var Record = null, Record_ = null;
      var Record_Date = null;
			
			do {
				Record_Group = Pattern.exec(Body);
			
				if (Record_Group) {
					Record_Date = Record_Group[1];
					RecordPattern = /<td[^]*?>\s*([^]*?)\s*<\/td>[^]*?<td[^]*?>\s*([^]*?)\s*<\/td>[^]*?<td[^]*?>\s*([^]*?)\s*<\/td>[^]*?<td[^]*?>\s*([^]*?)\s*<\/td>/gi;
					
					do {
						Record = RecordPattern.exec(Record_Group[2]);
						if (Record) {
							Record_ = {};
							Record_.date = Record_Date;
							Record_.time = Record[4];
							Record_.location = Record[3];
							Record_.description = Record[2];
							
							this_.Result.push(Record_);
						}
					} while (Record);
				}
			} while (Record_Group);
			
			Body = Body.replace(Pattern, "");
			Pattern = /colspan="5">[^]*?scope="col">\s*([^]*?)\s*<([^]*?)<\/table/gi;
			Record_Group = Pattern.exec(Body);
			if (Record_Group) {
				Record_Date = Record_Group[1];
				
				RecordPattern = /<td[^]*?>(\d+[^]*?)\s*<\/td>[^]*?<td[^]*?>\s*([^]*?)\s*<\/td>[^]*?<td[^]*?>\s*([^]*?)\s*<\/td>[^]*?<td[^]*?>\s*([^]*?)\s*<\/td>/gi;
				
				do {
					Record = RecordPattern.exec(Record_Group[2]);
					if (Record) {
						Record_ = {};
						Record_.date = Record_Date;
						Record_.time = Record[4];
						Record_.location = Record[3];
						Record_.description = Record[2];
						
						this_.Result.push(Record_);
					}
				} while (Record);
			}
			
			if (!this_.Result.length) {
	
				return Defer.reject(
					_CustomError(
						"ShipmentTracking.ASL",
						ErrorCodes.ERROR_NOT_FOUND
					)
				);
			}
			
			addInfo (Code, null, null, null, this_.Result);
			
			logResultStatus ("ASL", Code, Response.statusCode);
			
			return Defer.resolve([this_]);
		}
	);

	return Defer.promise;
};

ShipmentTracking.prototype.GlobalVietnam = function (Code) {
	var this_ = this;
	var Defer = _q.defer();
	var URL = "http://www.global-vietnam.vn/Page/TrackingResult.aspx?c=";

	if (typeof Code === "string") {
		Code = Code.replace(/\s+/g, '');
	} else {
		Code = "";
	}
	
	if (!Code || !Code.toString().match(/^\d{10}$/g)) {
		Defer.reject(
			_CustomError(
				"ShipmentTracking.ASL",
				ErrorCodes.ERROR_INVALID_FORMAT,
				Code
			)
		);

		return Defer.promise;
	}
	
	running ("GlobalVietnam", Code);
	
	this_.Request.get(
		{
			url: URL + Code.toString(),
		},
		function (Error_, Response, Body) {
			
			if (Error_) {
				return Defer.reject(
					_CustomError(
						"ShipmentTracking.GlobalVietnam",
						ErrorCodes.ERROR_REQUEST,
						Error_
					)
				);
			}

			if (Response.statusCode !== 200) {
				return Defer.reject(
					_CustomError(
						"ShipmentTracking.GlobalVietnam",
						ErrorCodes.ERROR_RESPONSE,
						Response
					)
				);
			}
			
			var Pattern = /Time_\d">([^]*?)<[^]*?Date_\d">([^]*?)<[^]*?<td>([^]*?)<\/td><td>([^]*?)</gi;
			var Record = null, Record_ = null;
      
			do {
				Record = Pattern.exec(Body);
				if (Record) {
					Record_ = {};
						Record_.date = Record[2];
						Record_.time = Record[1];
						Record_.location = Record[3];
						Record_.description = Record[4];
					
					this_.Result.push(Record_);
					
				}
			} while (Record);
			
			
			
			if (!this_.Result.length) {
	
				return Defer.reject(
					_CustomError(
						"ShipmentTracking.GlobalVietnam",
						ErrorCodes.ERROR_NOT_FOUND
					)
				);
			}
			
			var Info_ = /Destination[^]*?ToLocation">([^]*?)<[^]*?DeliveredOn">([^]*?)<[^]*?SignedBy">([^]*?)</gi.exec(Body);
			
			if (Info_) {
				addInfo (Code, Info_[1], Info_[3], Info_[2], this_.Result);
			} else {
				addInfo (Code, null, null, null, this_.Result);
			}
			
			logResultStatus ("GlobalVietnam", Code, Response.statusCode);
			
			return Defer.resolve([this_]);
		}
	);

	return Defer.promise;
};

ShipmentTracking.prototype.TDK = function (Code) {
	var this_ = this;
	var Defer = _q.defer();
	var url_1 = "http://tdkexpress.net/Search.html?ordering=&searchphrase=all&searchword=",
		url_2 = "http://tdkexpress.net/tracking/";

	if (typeof Code === "string") {
		Code = Code.replace(/\s+/g, '');
	} else {
		Code = "";
	}
	
	if (!Code || Code.toString().length > 5) {
		Defer.reject(
			_CustomError(
				"ShipmentTracking.TDK",
				ErrorCodes.ERROR_INVALID_FORMAT,
				Code
			)
		);

		return Defer.promise;
	}
	
	running ("TDK", Code);
	
	_request.get(
		url_1 + Code.toString(),
		function (err, res, bd) {
			
			this_.Request.get(
				{
					url: url_2 + Code.toString() + ".html",
				},
				function (Error_, Response, Body) {
					
					if (Error_) {
						return Defer.reject(
							_CustomError(
								"ShipmentTracking.TDK",
								ErrorCodes.ERROR_REQUEST,
								Error_
							)
						);
					}

					if (Response.statusCode !== 200) {
						return Defer.reject(
							_CustomError(
								"ShipmentTracking.TDK",
								ErrorCodes.ERROR_RESPONSE,
								Response
							)
						);
					}
										
					var pattern_1 = /#f6f6f6;">[^]*?(\d{4}-\d{2}-\d{2}\s+\w+)[^]*?<\/div[^]*?<table[^]*?>([^]*?)<\/table/gi;
					var pattern_2 = /70px;">([^]*?)<[^]*?break-word;">([^]*?)<\/td/gi;
					var pattern_3 = /height="2\d">(\d+\/\d+\/\d+)\s+([^]*?)<\/td/gi;
					var Record = null, Record_ = null;
          var Record_Date = null;
          
					do {
						Record_Date = pattern_1.exec(Body);
						
						if (Record_Date) {
							
							do {
								Record = pattern_2.exec(Record_Date[2]);
								
								if (Record) {
									Record_ = {};
									Record_.date = Record_Date[1];
									Record_.time = Record[1];
									Record_.location = "";
									Record_.description = Record[2].replace(/<[^]*?>/gi, "");
									
									this_.Result.push(Record_);
								}
								
							} while (Record);
						}

					} while (Record_Date);
					
					do {
						Record = pattern_3.exec(Body);
						if (Record) {
							Record_ = {};
							Record_.date = Record[1];
							Record_.time = "";
							Record_.location = "";
							Record_.description = Record[2];
							
							this_.Result.push(Record_);
						}
						
					} while (Record);
					
					if (!this_.Result.length) {
			
						return Defer.reject(
							_CustomError(
								"ShipmentTracking.TDK",
								ErrorCodes.ERROR_NOT_FOUND
							)
						);
					}

					var Info_ = /medium;">[^]*?\s-\s([^]*?)<\/span>/gi.exec(Body);
					if (Info_) {
						addInfo (Code, Info_[1], null, null, this_.Result);
					} else {
						addInfo (Code, null, null, null, this_.Result);
					}
					
					logResultStatus ("TDK", Code, Response.statusCode);
					
					return Defer.resolve([this_]);
				}
			);
		}
	);
	
	return Defer.promise;
};


ShipmentTracking.prototype.Post247 = function (Code) {
	var this_ = this;
	var Defer = _q.defer();
	var URL = "http://tracking.247post.vn/pms/?Mailer=";

	if (typeof Code === "string") {
		Code = Code.replace(/\s+/g, '');
	} else {
		Code = "";
	}
	
	if (!Code || Code.length != 11) {
		Defer.reject(
			_CustomError(
				"ShipmentTracking.Post247",
				ErrorCodes.ERROR_INVALID_FORMAT,
				Code
			)
		);

		return Defer.promise;
	}
	
	running ("Post247", Code);
	
	_request.get(
		{
			url: URL + Code.toString(),
		},
		function (err, res, bd) {
			
			if (err) {
				return Defer.reject(
					_CustomError(
						"ShipmentTracking.Post247",
						ErrorCodes.ERROR_REQUEST,
						err
					)
				);
			}

			if (res.statusCode !== 200) {
				return Defer.reject(
					_CustomError(
						"ShipmentTracking.Post247",
						ErrorCodes.ERROR_RESPONSE,
						res
					)
				);
			}

			var getViewStatePattern = /id="__VIEWSTATE"[^]*?"([^]*?)"/gi;
			var viewState = getViewStatePattern.exec(bd);
			
			if (!viewState) {
				return Defer.reject(
					_CustomError(
						"ShipmentTracking.Post247",
						"nullViewState",
						""
					)
				);
			}

			var Form = {
				__EVENTARGUMENT: "GetHistory," + Code,
				__VIEWSTATE: viewState[1],
			};
			
			this_.Request.post(
				{
					url: URL + Code.toString(),
					form: Form,
				},
				function (Error, Response, Body ) {
					
					if (Error) {
						return Defer.reject(
							_CustomError(
								"ShipmentTracking.Post247",
								ErrorCodes.ERROR_REQUEST,
								Error
							)
						);
					}

					if (Response.statusCode !== 200) {
						return Defer.reject(
							_CustomError(
								"ShipmentTracking.Post247",
								ErrorCodes.ERROR_RESPONSE,
								Response
							)
						);
					}
					
					var Pattern = /rowdetail1">\s+([^]*?)\s+<[^]*?rowdetail2">\s+([^]*?):([^]*?)\s+<[^]*?rowdetail1">\s+([^]*?)\s+<[^]*?rowdetail2">\s+([^]*?)\s+<[^]*?rowdetail1">/gi;
					var Record = null, Record_ = null;
          
					do {
						Record = Pattern.exec(Body);
						if (Record) {
							Record_ = {};
							Record_.date = Record[1];
							Record_.time = Record[3];
							Record_.location = Record[2];
							Record_.description = Record[4] + " - " + Record[5];
							
							this_.Result.splice(0, 0, Record_);
						}
					} while (Record);

					if (!this_.Result.length) {
						return Defer.reject(
							_CustomError(
								"ShipmentTracking.Post247",
								ErrorCodes.ERROR_NOT_FOUND
							)
						);
					}
					
					var infoPattern = /RecieverName" class="labelStyle">([^]*?),([^]*?)</gi;
					var Info_ = infoPattern.exec(Body);
					
					if (Info_) {
						addInfo (Code, null, Info_[1], Info_[2], this_.Result);
					} else {
						addInfo (Code, null, null, null, this_.Result);
					}
					
					logResultStatus ("Post247", Code, Response.statusCode);
					
					return Defer.resolve([this_]);
				}
			);
		}
	);

	return Defer.promise;
};

ShipmentTracking.prototype.VietAn = function (Code) {
	var this_ = this;
	var Defer = _q.defer();
	var URL = "http://vietanexpress.com.vn/index.php?route=tracking/search";
	var Form = {
			txttracking: Code,
			cmbtracking: "Track"
	};

	if (typeof Code === "string") {
		Code = Code.replace(/\s+/g, '');
	} else {
		Code = "";
	}
	
	if (!Code) {
		Defer.reject(
			_CustomError(
				"ShipmentTracking.VietAn",
				ErrorCodes.ERROR_INVALID_FORMAT,
				Code
			)
		);

		return Defer.promise;
	}
	
	running ("VietAn", Code);
	
	this_.Request.post(
		{
			url: URL,
			form: Form
		},
		function (Error, Response, Body) {
			
			if (Error) {
				return Defer.reject(
					_CustomError(
						"ShipmentTracking.VietAn",
						ErrorCodes.ERROR_REQUEST,
						Error
					)
				);
			}

			if (Response.statusCode !== 200) {
				return Defer.reject(
					_CustomError(
						"ShipmentTracking.VietAn",
						ErrorCodes.ERROR_RESPONSE,
						Response
					)
				);
			}
			
			VietAnSortData (Code, Body, this_.Result);

			if (!this_.Result.length) {
	
				return Defer.reject(
					_CustomError(
						"ShipmentTracking.VietAn",
						ErrorCodes.ERROR_NOT_FOUND
					)
				);
			}

			logResultStatus ("VietAn", Code, Response.statusCode);
			
			return Defer.resolve([this_]);
		}
	);
	
	return Defer.promise;
};

var VietAnSortData = function (Code, Data, Result) {

	var classifyPattern = /racking Detail<\/h1>[^]*?<([^]*?)\s*>([^]*?)checkpoints">([^]*?)<\/tabl/gi;				
	var Pattern = null, Record_Pattern = null;
	var Record_Group = null, Record_Date = null;
	var Record = null, Record_ = null, Info_ = null;
	
	var classifyArray = classifyPattern.exec(Data);
	
	if (classifyArray) {
		switch (classifyArray[1]) {
			case "div class=\"content-box-home\"":
				SortData_1();
				break;
			case "table":
				SortData_2();
				break;
			case "style type=\"text/css\"":
				SortData_3();
				break;
		}
	}
		
	function SortData_1 () {
		Pattern = /ad>([^]*?)<thead>([^]*?)<the/gi;					
	
		do {
			Record_Group = Pattern.exec(classifyArray[2]);
			
			if (Record_Group) {
				
				Record_Date = Record_Group[1].replace(/<[^]*?>|Location|Time/gi, "");
				Record_Pattern = /tr><td[^]*?>([^]*?)<[^]*?<td[^]*?>([^]*?)<[^]*?<td[^]*?>([^]*?)<[^]*?/gi;
				
				do {
					Record = Record_Pattern.exec(Record_Group[2]);
					if (Record) {
						Record_ = {};
						Record_.date = Record_Date;
						Record_.time = Record[3];
						Record_.location = Record[2];
						Record_.description = Record[1];
						
						Result.push(Record_);
					}	
				} while (Record);
			}
		} while (Record_Group);
		
		Record_Group = classifyArray[2].replace(Pattern, "");
		Record_Date = /<th c[^]*?>([^]*?)\s*</gi.exec(Record_Group);
		Record_Pattern = /<td co[^]*?>([^]*?)<[^]*?<td[^]*?>([^]*?)<[^]*?<td[^]*?>([^]*?)<[^]*?/gi;
		
		do {
			Record = Record_Pattern.exec(Record_Group);
			if (Record) {
				Record_ = {};
				Record_.date = Record_Date[1];
				Record_.time = Record[3];
				Record_.location = Record[2];
				Record_.description = Record[1];
				
				Result.push(Record_);
			}	
		} while (Record);
		
		Record_Date = /th c[^]*?>\s*([^]*?)</gi.exec(classifyArray[3]);
		Record_Pattern = /<td[^]*?>\s*([^]*?)\s*<[^]*?<td[^]*?>\s*([^]*?)\s*<[^]*?<td[^]*?>\s*([^]*?)\s*<[^]*?/gi;
		
		do {
			Record = Record_Pattern.exec(classifyArray[3]);
			if (Record) {
				Record_ = {};
				Record_.date = Record_Date[1];
				Record_.time = Record[3];
				Record_.location = Record[2];
				Record_.description = Record[1];
				
				Result.push(Record_);
			}
		} while (Record);
		
		Info_ = /tracking-results">[^]*?Signed for by:([^]*?)<[^]*?<span>([^]*?)<[^]*?<\/span><a><b>([^]*?)<[^]*?colspan="2">/gi.exec(Data);
		
		if (Info_) {
			addInfo (Code, Info_[3], Info_[1], Info_[2], Result);
		} else {
			addInfo (Code, null, null, null, Result);
		}
	}

	function SortData_2	() {
		
		Pattern = /ef">([^]*?)#efef/gi;

		do {
			Record_Group = Pattern.exec(classifyArray[2]);
			
			if (Record_Group) {
				
				Record_Date = /([^]*?)</.exec(Record_Group[1]);
				Record_Pattern = /<td>([^]*?)<[^]*?<td>([^]*?)<[^]*?<td>([^]*?)<[^]*?/gi;
				
				do {
					Record = Record_Pattern.exec(Record_Group[1]);
					if (Record) {
						Record_ = {};
						Record_.date = Record_Date[1];
						Record_.time = Record[1];
						Record_.location = Record[3];
						Record_.description = Record[2];
						
						Result.push(Record_);
					}
				} while (Record);
			}
		} while (Record_Group);
		
		Record_Group = classifyArray[2].replace(Pattern, "").replace(/Tracking[^]*?#efe/g, "");
		Record_Date = /fef">([^]*?)</gi.exec(Record_Group);
		Record_Pattern = /<td>([^]*?)<\/td>[^]*?<td>([^]*?)<\/td>[^]*?<td>([^]*?)<\/td>[^]*?/gi;
		
		do {
			Record = Record_Pattern.exec(Record_Group);
			if (Record) {
				Record_ = {};
				Record_.date = Record_Date[1];
				Record_.time = Record[1];
				Record_.location = Record[3];
				Record_.description = Record[2];
				
				Result.push(Record_);
			}
		} while (Record);
			
		Record_Date = /fef">\s*([^]*?)</gi.exec(classifyArray[3]);
		Record_Pattern = /<td>\s*([^]*?)<\/td>[^]*?<td[^]*?>\s*([^]*?)<\/td>[^]*?<td[^]*?>\s*([^]*?)<\/td>[^]*?/gi;
		
		do {
			Record = Record_Pattern.exec(classifyArray[3]);
			if (Record) {
				Record_ = {};
				Record_.date = Record_Date[1];
				Record_.time = Record[1];
				Record_.location = Record[3];
				Record_.description = Record[2].replace(/&nbsp/g, "");
				
				Result.push(Record_);
			}
		} while (Record);

		Info_ = /Tracking detail[^]*?Depart[^]*?<td>([^]*?)<[^]*?Signed for by:\s*([^]*?)</gi.exec(Data);
		if (Info_) {
			addInfo (Code, Info_[1], Info_[2], null, Result);
		} else {
			addInfo (Code, null, null, null, Result);
		}
	}

	function SortData_3	() {
	
		Pattern = /255, 0, 0\);"><strong>([^]*?)<([^]*?)<\/tb/gi;
		
		do {
			Record_Group = Pattern.exec(classifyArray[2]);
			
			if (Record_Group) {
				
				Record_Date = Record_Group[1];
				Record_Pattern = /<p>([^]*?)<\/p>[^]*?<p>([^]*?)<\/p>[^]*?<p>([^]*?)<\/p>[^]*?/gi;
				
				do {
					Record = Record_Pattern.exec(Record_Group[2]);
					var patternStrip = /<[^]*?>|\r|\n|\t|&nbsp;/gi;
					
					if (Record) {
						Record_ = {};
						Record_.date = Record_Date;
						Record_.time = Record[3].replace(patternStrip, "");
						Record_.location = Record[2].replace(patternStrip, "");
						Record_.description = Record[1].replace(patternStrip, "");
						
						Result.push(Record_);
					}
				} while (Record);
			}
		} while (Record_Group);
		
		Record_Date = /<th c[^]*?>\s*([^]*?)</gi.exec(classifyArray[3]);

		if (Record_Date) {
			Record_Pattern = /<td[^]*?>\s*([^]*?)\s*<\/td[^]*?<td[^]*?>\s*([^]*?)\s*<[^]*?<td[^]*?>\s*([^]*?)\s*<[^]*?/gi;
			do {
				Record = Record_Pattern.exec(classifyArray[3]);
				if (Record) {
					Record_ = {};
					Record_.date = Record_Date[1];
					Record_.time = Record[3].replace(/&nbsp/gi, "");
					Record_.location = Record[2].replace(/&nbsp/gi, "");
					Record_.description = Record[1].replace(/&nbsp/gi, "");
					
					Result.push(Record_);
				}
			} while (Record);
		}

		addInfo (Code, null, null, null, Result);
		
	}
	
};

ShipmentTracking.prototype.SaoViet = function (Code) {
	var this_ = this;
	var Defer = _q.defer();
	var URL = "http://saovietexpress.com/default.aspx";
	var Form = {
			__VIEWSTATE: '/wEPDwUENTM4MQ9kFgJmD2QWAgIBD2QWBgIHDxYCHgdWaXNpYmxlZxYCZg88KwANAQAPFgQeC18hRGF0YUJvdW5kZx4LXyFJdGVtQ291bnQCAmQWAmYPZBYGAgEPZBYKZg9kFgJmDxUBATJkAgEPZBYCZg8VAQoxMy8wNC8yMDE2ZAICD2QWAmYPFQEDMTBIZAIDD2QWAmYPFQExxJDDoyBnaWFvIHRow6BuaCBjw7RuZywgbmfGsOG7nWkgbmjhuq1uOiBLw50gVMOKTmQCBA9kFgJmDxUBBUhBTk9JZAICD2QWCmYPZBYCZg8VAQExZAIBD2QWAmYPFQEKMTIvMDQvMjAxNmQCAg9kFgJmDxUBBTA5OjE4ZAIDD2QWAmYPFQEhxJDhur9uIENodXllbiBQaGF0IE5oYW5oIFNhbyBWaWV0ZAIED2QWAmYPFQEFSEFOT0lkAgMPDxYCHwBoZGQCCQ8WAh8AaGQCDQ8WAh8AaGQYAQUOY3RsMDAkZ3JrZXRxdWEPPCsACgEIAgFkooZK1d//naj2CY44qHh2m4ep+7Y=',
			__EVENTVALIDATION: '/wEWAwK6uIToAwKRv+CpDwKZw+rtB2cltFHfIlwlhVrCJ/x+drx9WcLW',
      ctl00$so_hieu: Code.toString(),
      ctl00$btn_tracking: 'ĐỊNH VỊ'
	};

	if (typeof Code === "string") {
		Code = Code.replace(/\s+/g, '');
	} else {
		Code = "";
	}
	
	if (!Code || Code.length != 6) {
		Defer.reject(
			_CustomError(
				"ShipmentTracking.SaoViet",
				ErrorCodes.ERROR_INVALID_FORMAT,
				Code
			)
		);

		return Defer.promise;
	}
	
	running ("SaoViet", Code);
	
	_request.post(
		{
			url: URL,
			form: Form
		},
		function (Error, Response, Body) {
			
			if (Error) {
				return Defer.reject(
					_CustomError(
						"ShipmentTracking.SaoViet",
						ErrorCodes.ERROR_REQUEST,
						Error
					)
				);
			}

			if (Response.statusCode !== 200) {
				return Defer.reject(
					_CustomError(
						"ShipmentTracking.SaoViet",
						ErrorCodes.ERROR_RESPONSE,
						Response
					)
				);
			}
      
      var Pattern = /<td class="list" align="left">\s*([^]*?)\s*<\/td><td class="list" align="left">\s*([^]*?)\s*<\/td><td class="list" align="left">\s*([^]*?)\s*<\/td><td align="center">\s*([^]*?)\s*<\/td>/gi;
      var Record = null, Record_ = null;
      
      do {
        Record = Pattern.exec(Body);
        if (Record) {
          Record_ = {};
          Record_.date = Record[1];
          Record_.time = Record[2];
          Record_.location = Record[4];
          Record_.description = Record[3];
          
          this_.Result.push(Record_);
        }
      } while (Record);

      if (!this_.Result.length) {
        return Defer.reject(
          _CustomError(
            "ShipmentTracking.SaoViet",
            ErrorCodes.ERROR_NOT_FOUND
          )
        );
      }
      
      var infoPattern = /Họ tên người nhận[^]*?<td >([^]*?)<[^]*?<b>Người nhận[^]*?class="style1" >([^]*?)<[^]*?(\d+\/\d+\/\d+)[^]*?<td >Giờ giao[^]*?<td >([^]*?)<\/td>/gi;
      var Info_ = infoPattern.exec(Body);
      
      if (Info_) {
        Info_[1] = Info_[1] == 'KÝ TÊN' ? '': Info_[1]; 
        addInfo (Code, Info_[2], Info_[1], Info_[4] + ' ngày ' + Info_[3], this_.Result);
      } else {
        addInfo (Code, null, null, null, this_.Result);
      }
      
      logResultStatus ("SaoViet", Code, Response.statusCode);
      
      return Defer.resolve([this_]);
      
		}
	);

	return Defer.promise;
};

var ShipmentTracking_ = new ShipmentTracking();

_q.spread(
	[ShipmentTracking_],
		function (ShipmentTracking) {return [ShipmentTracking];}) // DHL - 7247943043
.spread(function (ShipmentTracking) {return [ShipmentTracking];}) // FedEx - 649935590053
.spread(function (ShipmentTracking) {return [ShipmentTracking];}) // TNT - 330919081
.spread(function (ShipmentTracking) {return [ShipmentTracking];}) // UPS - 1Z4987EA0473741956
.spread(function (ShipmentTracking) {return [ShipmentTracking];}) // ViettelPost - 0357246544
.spread(function (ShipmentTracking) {return [ShipmentTracking];}) // VNPost - EE058309541VN
.spread(function (ShipmentTracking) {return [ShipmentTracking];}) // Skyworldex - 8418014856
.spread(function (ShipmentTracking) {return [ShipmentTracking];}) // Skydart - han151102537
.spread(function (ShipmentTracking) {return [ShipmentTracking];}) // WCE - 200105350
.spread(function (ShipmentTracking) {return [ShipmentTracking];}) // CPQT - 004601
//.spread(function (ShipmentTracking) {return [ShipmentTracking];}) // Fardar - 7630185894
.spread(function (ShipmentTracking) {return [ShipmentTracking];}) // ASL - 0005426
.spread(function (ShipmentTracking) {return [ShipmentTracking];}) // GblobalVietnam - 8410000128 - 8410000470
.spread(function (ShipmentTracking) {return [ShipmentTracking];}) // TDK - 8052 - 8053 - 8054 - 13939
.spread(function (ShipmentTracking) {return [ShipmentTracking];}) // Post247 - 03003827093 - 03003827031 - 03003827014 - 03003827045
.spread(function (ShipmentTracking) {return [ShipmentTracking];}) // Viet An - 082426 - 082430- 082435 - 082439 - 078422
.spread(function (ShipmentTracking) {return [ShipmentTracking];}) // SaoViet 023052 - 021183

	
.spread(
	function (ShipmentTracking) {
		console.log(ShipmentTracking.Result);
	}
).fail(
	function (Error_) {
		console.log(Error_);
	}
).done(
	function () {
		console.log("Done");
	}
);

_tracker.get(
	'/',
	function (Request, Response) {
		var Code = (Request.query.code).toUpperCase();
		var date = new Date(),
			day = date.getDate(),
			month = date.getMonth()+1,
			hours = date.getHours(),
			minutes = date.getMinutes(),
			seconds = date.getSeconds();
			
		if (day < 10) {day = "0" + day;}
		if (month < 10) {month = "0" + month;}
		if (hours < 10) {hours = "0" + hours;}
		if (minutes < 10) {minutes = "0" + minutes;}
		if (seconds < 10) {seconds = "0" + seconds;}
		
		var receiveTime = day + "/" + month + "-" + hours + ":" + minutes + ":" + seconds;
		
		console.log(receiveTime + " Receive: " + Code);
		
		var Jobs = [
			new ShipmentTracking().DHL(Code),
			new ShipmentTracking().FedEx(Code),
			new ShipmentTracking().TNT(Code),
			new ShipmentTracking().UPS(Code),
			new ShipmentTracking().ViettelPost(Code),
			new ShipmentTracking().VNPost(Code),
			new ShipmentTracking().Skyworldex(Code),
			new ShipmentTracking().Skydart(Code),
			new ShipmentTracking().WCE(Code),
			new ShipmentTracking().CPQT(Code),
			//new ShipmentTracking().Fardar(Code),
			new ShipmentTracking().ASL(Code),
			new ShipmentTracking().GlobalVietnam(Code),
			new ShipmentTracking().TDK(Code),
			new ShipmentTracking().Post247(Code),
			new ShipmentTracking().VietAn(Code),
      new ShipmentTracking().SaoViet(Code),
		];

		_q.any(Jobs).then(
			function (ShipmentTracking) {
				Response.json(ShipmentTracking[0].Result);
			},
			function (Error_) {
				Response.end();
			}
		);
	}
);

var server = _tracker.listen(
	8000,
	function () {
	}
);