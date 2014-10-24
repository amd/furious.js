#include <stddef.h>
#include <unistd.h>

#include <ppapi/c/pp_instance.h>
#include <ppapi/c/pp_var.h>

#include "Error.h"
#include "Commands.h"
#include "Interfaces.h"

#include "Requests.pb-c.h"
#include "Responses.pb-c.h"

enum FJS_Error FJS_Dispatch_Init(PP_Instance instance) {
	Furious__Response response;
	furious__response__init(&response);
	response.id = 0;
	response.type = FURIOUS__RESPONSE__TYPE__INIT;

	const long concurrency = sysconf(_SC_NPROCESSORS_ONLN);
	if (concurrency > 0) {
		Furious__InitResponse init_response;
		furious__init_response__init(&init_response);
		init_response.concurrency = concurrency;
		response.init_response = &init_response;
	}

	const size_t responseSize = furious__response__get_packed_size(&response);
	struct PP_Var responseVar = bufferInterface->Create(responseSize);
	void* responsePointer = bufferInterface->Map(responseVar);
	if (responsePointer != NULL) {
		furious__response__pack(&response, responsePointer);
		bufferInterface->Unmap(responseVar);
		messagingInterface->PostMessage(instance, responseVar);
	}
	varInterface->Release(responseVar);
	return FJS_Error_Ok;
}

enum FJS_Error FJS_Dispatch_Request(PP_Instance instance, const void* requestPointer, size_t requestSize) {
	Furious__Request* request = furious__request__unpack(NULL, requestSize, requestPointer);
	if (request == NULL) {
		return FJS_Error_InvalidProtobuf;
	}

	const Furious__Request__Type request_type = request->type;
	switch (request_type) {
		case FURIOUS__REQUEST__TYPE__EMPTY_ARRAY:
		{
			const Furious__EmptyArrayRequest *empty_array_request = request->empty_array_request;
			const struct FJS_Shape shape = {
				.buffer = empty_array_request->shape,
				.dimensions = empty_array_request->n_shape
			};
			return FJS_Execute_CreateEmptyArray(instance,
				empty_array_request->id_out,
				shape,
				(enum FJS_DataType) empty_array_request->data_type);
		}
		case FURIOUS__REQUEST__TYPE__DATA_ARRAY:
		{
			const Furious__DataArrayRequest *data_array_request = request->data_array_request;
			const struct FJS_Shape shape = {
				.buffer = data_array_request->shape,
				.dimensions = data_array_request->n_shape
			};
			const struct FJS_Buffer data_buffer = {
				.pointer = data_array_request->data_buffer.data,
				.size = data_array_request->data_buffer.len
			};
			return FJS_Execute_CreateDataArray(instance,
				data_array_request->id_out,
				shape,
				(enum FJS_DataType) data_array_request->data_type,
				data_buffer);
		}
		case FURIOUS__REQUEST__TYPE__CONST_ARRAY:
		{
			const Furious__ConstArrayRequest *const_array_request = request->const_array_request;
			const struct FJS_Shape shape = {
				.buffer = const_array_request->shape,
				.dimensions = const_array_request->n_shape
			};
			return FJS_Execute_CreateConstArray(instance,
				const_array_request->id_out,
				shape,
				(enum FJS_DataType) const_array_request->data_type,
				const_array_request->fill_value);
		}
		case FURIOUS__REQUEST__TYPE__IDENTITY_MATRIX:
		{
			const Furious__IdentityMatrixRequest *identity_matrix_request = request->identity_matrix_request;
			return FJS_Execute_CreateIdentityMatrix(instance,
				identity_matrix_request->id_out,
				identity_matrix_request->rows,
				identity_matrix_request->columns,
				identity_matrix_request->diagonal,
				(enum FJS_DataType) identity_matrix_request->data_type);
		}
		case FURIOUS__REQUEST__TYPE__LINSPACE:
		{
			const Furious__LinspaceRequest *linspace_request = request->linspace_request;
			return FJS_Execute_LinSpace(instance,
				linspace_request->id_out,
				linspace_request->start,
				linspace_request->stop,
				linspace_request->samples,
				linspace_request->closed,
				(enum FJS_DataType) linspace_request->data_type);
		}
		case FURIOUS__REQUEST__TYPE__RESHAPE:
		{
			const Furious__ReshapeRequest *reshape_request = request->reshape_request;
			const struct FJS_Shape shape_out = {
				.buffer = reshape_request->shape_out,
				.dimensions = reshape_request->n_shape_out
			};
			return FJS_Execute_ReShape(instance,
				reshape_request->id_a,
				reshape_request->id_out,
				shape_out);
		}
		case FURIOUS__REQUEST__TYPE__REPEAT:
		{
			const Furious__RepeatRequest *repeat_request = request->repeat_request;
			return FJS_Execute_Repeat(instance,
				repeat_request->id_a,
				repeat_request->id_out,
				repeat_request->repeats,
				repeat_request->axis);
		}
		case FURIOUS__REQUEST__TYPE__DEALLOCATE:
		{
			const Furious__DeallocateRequest *deallocate_request = request->deallocate_request;
			return FJS_Execute_DeAllocate(instance,
				deallocate_request->id_a);
		}
		case FURIOUS__REQUEST__TYPE__FETCH:
		{
			struct FJS_Buffer buffer;
			const Furious__FetchRequest *fetch_request = request->fetch_request;
			const enum FJS_Error error = FJS_Execute_Fetch(instance,
				fetch_request->id_a,
				&buffer);
			if (error == FJS_Error_Ok) {
				Furious__Response response;
				furious__response__init(&response);
				response.id = request->id;
				response.type = FURIOUS__RESPONSE__TYPE__FETCH;

				Furious__FetchResponse fetch_response;
				furious__fetch_response__init(&fetch_response);
				fetch_response.data_buffer.data = buffer.pointer;
				fetch_response.data_buffer.len = buffer.size;

				response.fetch_response = &fetch_response;

				const size_t response_size = furious__response__get_packed_size(&response);
				struct PP_Var response_variable = bufferInterface->Create(response_size);
				void* response_pointer = bufferInterface->Map(response_variable);
				if (response_pointer != NULL) {
					furious__response__pack(&response, response_pointer);
					bufferInterface->Unmap(response_variable);
					messagingInterface->PostMessage(instance, response_variable);
				}
				varInterface->Release(response_variable);
			}
			return error;
		}
		case FURIOUS__REQUEST__TYPE__INFO:
		case FURIOUS__REQUEST__TYPE__BARRIER:
		{
			Furious__Response response;
			furious__response__init(&response);
			response.id = request->id;
			response.type = FURIOUS__RESPONSE__TYPE__BARRIER;

			const size_t response_size = furious__response__get_packed_size(&response);
			struct PP_Var response_variable = bufferInterface->Create(response_size);
			void* response_pointer = bufferInterface->Map(response_variable);
			if (response_pointer != NULL) {
				furious__response__pack(&response, response_pointer);
				bufferInterface->Unmap(response_variable);
				messagingInterface->PostMessage(instance, response_variable);
			}
			varInterface->Release(response_variable);

			return FJS_Error_Ok;
		}
		case FURIOUS__REQUEST__TYPE__BINARY_OPERATION:
		{
			const Furious__BinaryOperationRequest *binary_operation_request = request->binary_operation_request;
			return FJS_Execute_BinaryOperation(instance,
				(enum FJS_BinaryOperationType) binary_operation_request->type,
				binary_operation_request->id_a,
				binary_operation_request->id_b,
				binary_operation_request->id_out);
		}
		case FURIOUS__REQUEST__TYPE__BINARY_CONST_OPERATION:
		{
			const Furious__BinaryConstOperationRequest *binary_const_operation_request = request->binary_const_operation_request;
			return FJS_Execute_BinaryConstOperation(instance,
				(enum FJS_BinaryConstOperationType) binary_const_operation_request->type,
				binary_const_operation_request->id_a,
				binary_const_operation_request->value_b,
				binary_const_operation_request->id_out);
		}
		case FURIOUS__REQUEST__TYPE__UNARY_OPERATION:
		{
			const Furious__UnaryOperationRequest *unary_operation_request = request->unary_operation_request;
			return FJS_Execute_UnaryOperation(instance,
				(enum FJS_UnaryOperationType) unary_operation_request->type,
				unary_operation_request->id_a,
				unary_operation_request->id_out);
		}
		case FURIOUS__REQUEST__TYPE__REDUCTION_OPERATION:
		{
			const Furious__ReductionRequest *reduction_request = request->reduction_request;
			return FJS_Execute_Reduction(instance,
				(enum FJS_ReductionType) reduction_request->type,
				reduction_request->id_a,
				reduction_request->id_out);
		}
		case FURIOUS__REQUEST__TYPE__AXIS_REDUCTION_OPERATION:
		{
			const Furious__AxisReductionRequest *axis_reduction_request = request->axis_reduction_request;
			return FJS_Execute_AxisReduction(instance,
				(enum FJS_AxisReductionType) axis_reduction_request->type,
				axis_reduction_request->id_a,
				axis_reduction_request->axis,
				axis_reduction_request->id_out);
		}
		case FURIOUS__REQUEST__TYPE__DOT_OPERATION:
		{
			const Furious__DotOperationRequest *dot_operation_request = request->dot_operation_request;
			return FJS_Execute_DotOperation(instance,
				dot_operation_request->id_a,
				dot_operation_request->id_b,
				dot_operation_request->id_out);
		}
		case FURIOUS__REQUEST__TYPE__CHOLESKY_DECOMPOSITION:
		{
			const Furious__CholeskyDecompositionRequest *cholesky_decomposition_request = request->cholesky_decomposition_request;
			return FJS_Execute_CholeskyDecomposition(instance,
				cholesky_decomposition_request->id_a,
				cholesky_decomposition_request->a_type == FURIOUS__TRIANGULAR_MATRIX_TYPE__LOWER,
				cholesky_decomposition_request->id_out);
		}
		case FURIOUS__REQUEST__TYPE__SOLVE_TRIANGULAR:
		{
			const Furious__SolveTriangularRequest *solve_triangular_request = request->solve_triangular_request;
			return FJS_Execute_SolveTriangular(instance,
				solve_triangular_request->id_a,
				solve_triangular_request->id_y,
				solve_triangular_request->id_x,
				solve_triangular_request->a_type == FURIOUS__TRIANGULAR_MATRIX_TYPE__LOWER,
				solve_triangular_request->a_transposition == FURIOUS__TRANSPOSITION_TYPE__TRANSPOSE,
				solve_triangular_request->unit_diagonal);
		}
		default:
			__builtin_unreachable();
	}
}
