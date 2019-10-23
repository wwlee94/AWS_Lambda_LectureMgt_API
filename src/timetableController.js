var errorMessage = require("./errorMessage");
var request = require("request");

// timetable GET 요청
module.exports.GET = function(dynamo, queryparam, postbody, callback) {
  //GET 메소드
  if (queryparam !== null) {
    if ("user_key" in queryparam) {
      if (queryparam["user_key"] !== "") {
        var params = {
          TableName: 'programmers_timetable',
          ProjectionExpression: "lecture_code", //보여줄 column
          KeyConditionExpression: "user_key = :key",
          ExpressionAttributeValues: {
            ":key": queryparam["user_key"]
          }
        };
        dynamo.query(params, (err, data) => {
          callback(null, {
            'statusCode': 200,
            'headers': {},
            'body': JSON.stringify(data)
          });
        });
      } else callback(null, {
        'statusCode': 400,
        'body': errorMessage("/programmers/timetable", "GET", "user_key 요청 변수가 비어 있어 시간표를 조회 할 수 없습니다.")
      });
    }
  } else callback(null, {
    'statusCode': 400,
    'body': errorMessage("/programmers/timetable", "GET", "user_key 요청 변수가 없어 시간표를 조회 할 수 없습니다.")
  });
};
// timetable POST 요청
module.exports.POST = function(dynamo, queryparam, postbody, callback) {
  var token_validation = false;
  //validation
  if (postbody !== null) {
    if ("user_key" in postbody && "code" in postbody) {
      //user_key 값이 존재할 때
      if (postbody["user_key"] != "") {
        const options = {
          uri: "https://www.programmers.co.kr/api/assignment_api/check_if_valid_token",
          qs: {
            token: postbody["user_key"]
          }
        };
        // 사용자 ID 토큰 valid 요청
        request(options, function(err, response, body) {
          //callback
          body = JSON.parse(body);
          token_validation = body["valid"];
          // 토큰이 검증 되었으면
          if (token_validation) {
            // 강의 중복검사 & 강의 코드 추가
            searchOverlapLecture(dynamo, postbody, callback);
          }
          // token이 유효하지 않을 때
          else {
            callback(null, {
              'statusCode': 422,
              'body': errorMessage("/programmers/timetable", "POST", "유효한 사용자 ID 토큰이 아닙니다. 정확한 프로그래머스 사용자 ID 토큰을 요청해주세요.")
            });
          }
        });
      } else callback(null, {
        'statusCode': 400,
        'body': errorMessage("/programmers/timetable", "POST", "user_key 요청 변수가 비어 있어 데이터를 삽입 할 수 없습니다.")
      });
    }
    // user_key & code가 존재하는지 여부
    else if ("user_key" in postbody && !("code" in postbody)) callback(null, {
      'statusCode': 400,
      'body': errorMessage("/programmers/timetable", "POST", "code 요청 변수가 없어 데이터를 삽입 할 수 없습니다.")
    });
    else if (!("user_key" in postbody) && "code" in postbody) callback(null, {
      'statusCode': 400,
      'body': errorMessage("/programmers/timetable", "POST", "user_key 요청 변수가 없어 데이터를 삽입 할 수 없습니다.")
    });
  } else callback(null, {
    'statusCode': 400,
    'body': errorMessage("/programmers/timetable", "POST", "user_key, code 요청 변수가 없어 데이터를 삽입 할 수 없습니다.")
  });
}

// timetable DELETE 요청
module.exports.DELETE = function(dynamo, queryparam, postbody, callback) {
  //validation
  if (postbody !== null) {
    if ("user_key" in postbody && "code" in postbody) {
      //데이터 추가 작업
      var params = {
        TableName: 'programmers_timetable',
        Key: {
          "user_key": postbody["user_key"],
          "lecture_code": postbody["code"]
        },
        ConditionExpression: "user_key = :key and lecture_code = :code",
        ExpressionAttributeValues: {
          ":key": postbody["user_key"],
          ":code": postbody["code"]
        }
      }
      var text = "";
      var status = 200;
      dynamo.delete(params, (err, data) => {
        if (err) {
          text = JSON.stringify({
            "message": "강의 코드 삭제 에러 - " + err
          });
          status = 422;
        } else text = JSON.stringify({
          "user_key": postbody["user_key"],
          "code": postbody["code"],
          "message": "강의 코드 삭제 성공 !"
        });
        callback(null, {
          'statusCode': status,
          'headers': {},
          'body': text
        });
      });
    } else if ("user_key" in postbody && !("code" in postbody)) callback(null, {
      'statusCode': 400,
      'body': errorMessage("/programmers/timetable", "DELETE", "code 요청 변수가 없어 데이터를 삭제 할 수 없습니다.")
    });
    else if (!("user_key" in postbody) && "code" in postbody) callback(null, {
      'statusCode': 400,
      'body': errorMessage("/programmers/timetable", "DELETE", "user_key 요청 변수가 없어 데이터를 삭제 할 수 없습니다.")
    });
  } else callback(null, {
    'statusCode': 400,
    'body': errorMessage("/programmers/timetable", "DELETE", "user_key, code 요청 변수가 없어 데이터를 삭제 할 수 없습니다.")
  });
}

//강의 코드 추가
function insertLecture(dynamo, postbody, callback) {
  var params = {
    TableName: 'programmers_timetable',
    Item: {
      "user_key": postbody["user_key"],
      "lecture_code": postbody["code"]
    }
  };

  var text = "";
  var status = 200;

  dynamo.put(params, (err, data) => {
    if (err) {
      text = JSON.stringify({
        "message": "강의 코드 삽입 에러 - " + err
      });
      status = 500;
    } else text = JSON.stringify({
      "user_key": postbody["user_key"],
      "code": postbody["code"],
      "message": "강의 코드 삽입 성공 !"
    });

    callback(null, {
      'statusCode': status,
      'headers': {},
      'body': text
    });
  });
}

// 강의 코드 중복 검사
function searchOverlapLecture(dynamo, postbody, callback) {

  var params = {
    TableName: 'programmers_timetable',
    KeyConditionExpression: "user_key = :key and lecture_code = :code",
    ExpressionAttributeValues: {
      ":key": postbody["user_key"],
      ":code": postbody["code"]
    }
  };

  dynamo.query(params, (err, data) => {
    var insertState = true
    if (data["Count"] !== 0) insertState = false;

    if (insertState) {
      //강의 코드 추가 작업
      insertLecture(dynamo, postbody, callback);

    } else callback(null, {
      'statusCode': 422,
      'body': errorMessage("/programmers/timetable", "POST", "중복되는 데이터가 존재합니다.")
    });
  });
}
