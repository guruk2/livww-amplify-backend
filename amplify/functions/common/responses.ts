// Consistent response formatting across Lambda functions
export const createSuccessResponse = (data: any) => {
    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "*"
      },
        body: JSON.stringify({
        message: "Successfully synced",
        data:data,
        error:false,
        timestamp: new Date().toISOString()
      })
         };
  };
  
  export const createErrorResponse = (statusCode: number, message: string) => {
    return {
      statusCode,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "*"
      },
      body: JSON.stringify({
        message: message,
        data:null,
        error:true,
        timestamp: new Date().toISOString()
      })
    };
  };
  