#include <cstddef>

#include <ppapi/c/pp_instance.h>
#include <ppapi/c/pp_var.h>

#include "Error.h"
#include "Commands.h"

#include "Requests.pb.h"

extern "C" enum FJS_Error FJS_DispatchRequest(PP_Instance instance, const void* requestPointer, size_t requestSize) {
	furious::Request request;
	if (!request.ParseFromArray(requestPointer, requestSize)) {
		return FJS_Error_InvalidProtobuf;
	}

	furious::Request::Type requestType = request.type();
	switch (requestType) {
		case furious::Request_Type_EMPTY_ARRAY:
		{
			const furious::EmptyArrayRequest& emptyArrayRequest = request.empty_array_request();
			const struct FJS_Shape shape = {
				.buffer = const_cast<uint32_t*>(emptyArrayRequest.shape().data()),
				.dimensions = static_cast<uint32_t>(emptyArrayRequest.shape().size())
			};
			return FJS_Execute_CreateEmptyArray(instance,
				emptyArrayRequest.id_out(),
				shape,
				static_cast<enum FJS_DataType>(emptyArrayRequest.data_type()));
		}
		case furious::Request_Type_DATA_ARRAY:
		{
			const furious::DataArrayRequest& dataArrayRequest = request.data_array_request();
			const struct FJS_Shape shape = {
				.buffer = const_cast<uint32_t*>(dataArrayRequest.shape().data()),
				.dimensions = static_cast<uint32_t>(dataArrayRequest.shape().size())
			};
			const struct FJS_Buffer dataBuffer = {
				.pointer = const_cast<void*>(static_cast<const void*>(dataArrayRequest.data_buffer().data())),
				.size = static_cast<uint32_t>(dataArrayRequest.data_buffer().size())
			};
			return FJS_Execute_CreateDataArray(instance,
				dataArrayRequest.id_out(),
				shape,
				static_cast<enum FJS_DataType>(dataArrayRequest.data_type()),
				dataBuffer);
		}
		case furious::Request_Type_CONST_ARRAY:
		{
			const furious::ConstArrayRequest& constArrayRequest = request.const_array_request();
			const struct FJS_Shape shape = {
				.buffer = const_cast<uint32_t*>(constArrayRequest.shape().data()),
				.dimensions = static_cast<uint32_t>(constArrayRequest.shape().size())
			};
			return FJS_Execute_CreateConstArray(instance,
				constArrayRequest.id_out(),
				shape,
				static_cast<enum FJS_DataType>(constArrayRequest.data_type()),
				constArrayRequest.fill_value());
		}
		case furious::Request_Type_LINSPACE:
		{
			const furious::LinspaceRequest& linspaceRequest = request.linspace_request();
			return FJS_Execute_LinSpace(instance,
				linspaceRequest.id_out(),
				linspaceRequest.start(),
				linspaceRequest.stop(),
				linspaceRequest.samples(),
				linspaceRequest.closed(),
				static_cast<enum FJS_DataType>(linspaceRequest.data_type()));
		}
		case furious::Request_Type_RESHAPE:
		{
			const furious::ReshapeRequest& reshapeRequest = request.reshape_request();
			const FJS_Shape shapeOut = {
				.buffer = const_cast<uint32_t*>(reshapeRequest.shape_out().data()),
				.dimensions = static_cast<uint32_t>(reshapeRequest.shape_out().size())
			};
			return FJS_Execute_ReShape(instance,
				reshapeRequest.id_a(),
				reshapeRequest.id_out(),
				shapeOut);
		}
		case furious::Request_Type_REPEAT:
		{
			const furious::RepeatRequest& repeatRequest = request.repeat_request();
			return FJS_Execute_Repeat(instance,
				repeatRequest.id_a(),
				repeatRequest.id_out(),
				repeatRequest.repeats(),
				repeatRequest.axis());
		}
		case furious::Request_Type_DEALLOCATE:
		{
			const furious::DeallocateRequest& deallocateRequest = request.deallocate_request();
			return FJS_Execute_DeAllocate(instance,
				deallocateRequest.id_a());
		}
		case furious::Request_Type_FETCH:
		{
			struct FJS_Buffer buffer;
			const furious::FetchRequest& fetchRequest = request.fetch_request();
			return FJS_Execute_Fetch(instance,
				fetchRequest.id_a(),
				&buffer);
		}
		case furious::Request_Type_BINARY_OPERATION:
		{
			const furious::BinaryOperationRequest& binaryOperationRequest = request.binary_operation_request();
			return FJS_Execute_BinaryOperation(instance,
				static_cast<enum FJS_BinaryOperationType>(binaryOperationRequest.type()),
				binaryOperationRequest.id_a(),
				binaryOperationRequest.id_b(),
				binaryOperationRequest.id_out());
		}
		case furious::Request_Type_BINARY_CONST_OPERATION:
		{
			const furious::BinaryConstOperationRequest& binaryConstOperationRequest = request.binary_const_operation_request();
			return FJS_Execute_BinaryConstOperation(instance,
				static_cast<enum FJS_BinaryConstOperationType>(binaryConstOperationRequest.type()),
				binaryConstOperationRequest.id_a(),
				binaryConstOperationRequest.value_b(),
				binaryConstOperationRequest.id_out());
		}
		case furious::Request_Type_UNARY_OPERATION:
		{
			const furious::UnaryOperationRequest& unaryOperationRequest = request.unary_operation_request();
			return FJS_Execute_UnaryOperation(instance,
				static_cast<enum FJS_UnaryOperationType>(unaryOperationRequest.type()),
				unaryOperationRequest.id_a(),
				unaryOperationRequest.id_out());
		}
		case furious::Request_Type_REDUCTION_OPERATION:
		{
			const furious::ReductionRequest& reductionRequest = request.reduction_request();
			return FJS_Execute_Reduction(instance,
				static_cast<enum FJS_ReductionType>(reductionRequest.type()),
				reductionRequest.id_a(),
				reductionRequest.id_out());
		}
		case furious::Request_Type_AXIS_REDUCTION_OPERATION:
		{
			const furious::AxisReductionRequest& axisReductionRequest = request.axis_reduction_request();
			return FJS_Execute_AxisReduction(instance,
				static_cast<enum FJS_AxisReductionType>(axisReductionRequest.type()),
				axisReductionRequest.id_a(),
				axisReductionRequest.axis(),
				axisReductionRequest.id_out());
		}
		case furious::Request_Type_DOT_OPERATION:
		{
			const furious::DotOperationRequest& dotOperationRequest = request.dot_operation_request();
			return FJS_Execute_DotOperation(instance,
				dotOperationRequest.id_a(),
				dotOperationRequest.id_b(),
				dotOperationRequest.id_out());
		}
	}
}
