#include <cstddef>

#include <ppapi/c/pp_instance.h>
#include <ppapi/c/pp_var.h>

#include <unistd.h>

#include "Error.h"
#include "Commands.h"
#include "Interfaces.h"

#include "Requests.pb.h"
#include "Responses.pb.h"

extern "C" enum FJS_Error FJS_Dispatch_Init(PP_Instance instance) {
	furious::Response response;
	response.set_id(0);
	response.set_type(furious::Response::INIT);

	const long concurrency = sysconf(_SC_NPROCESSORS_ONLN);
	if (concurrency > 0) {
		furious::InitResponse* initResponse = new furious::InitResponse();
		if (initResponse != NULL) {
			initResponse->set_concurrency(concurrency);
			response.set_allocated_init_response(initResponse);
		}
	}

	const int responseSize = response.ByteSize();
	struct PP_Var responseVar = bufferInterface->Create(static_cast<uint32_t>(responseSize));
	void* requestPointer = bufferInterface->Map(responseVar);
	if (requestPointer != NULL) {
		if (response.SerializeToArray(requestPointer, responseSize)) {
			messagingInterface->PostMessage(instance, responseVar);
		}
		bufferInterface->Unmap(responseVar);
	}
	varInterface->Release(responseVar);
	return FJS_Error_Ok;
}

extern "C" enum FJS_Error FJS_Dispatch_Request(PP_Instance instance, const void* requestPointer, size_t requestSize) {
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
		case furious::Request_Type_IDENTITY_MATRIX:
		{
			const furious::IdentityMatrixRequest& identityMatrixRequest = request.identity_matrix_request();
			return FJS_Execute_CreateIdentityMatrix(instance,
				identityMatrixRequest.id_out(),
				identityMatrixRequest.rows(),
				identityMatrixRequest.columns(),
				identityMatrixRequest.diagonal(),
				static_cast<enum FJS_DataType>(identityMatrixRequest.data_type()));
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
			const enum FJS_Error error = FJS_Execute_Fetch(instance,
				fetchRequest.id_a(),
				&buffer);
			if (error == FJS_Error_Ok) {
				furious::Response response;
				response.set_id(request.id());
				response.set_type(furious::Response::FETCH);

				furious::FetchResponse* fetchResponse = new furious::FetchResponse();
				/* Note: the code is compiled without exception support */
				if (fetchResponse != NULL) {
					fetchResponse->set_data_buffer(buffer.pointer, buffer.size);
					response.set_allocated_fetch_response(fetchResponse);

					const int responseSize = response.ByteSize();
					struct PP_Var responseVar = bufferInterface->Create(static_cast<uint32_t>(responseSize));
					void* requestPointer = bufferInterface->Map(responseVar);
					if (requestPointer != NULL) {
						if (response.SerializeToArray(requestPointer, responseSize)) {
							messagingInterface->PostMessage(instance, responseVar);
						}
						bufferInterface->Unmap(responseVar);
					}
					varInterface->Release(responseVar);
				}
			}
			return error;
		}
		case furious::Request_Type_INFO:
		case furious::Request_Type_BARRIER:
		{
			furious::Response response;
			response.set_id(request.id());
			response.set_type(furious::Response::BARRIER);

			const int responseSize = response.ByteSize();
			struct PP_Var responseVar = bufferInterface->Create(static_cast<uint32_t>(responseSize));
			void* requestPointer = bufferInterface->Map(responseVar);
			if (requestPointer != NULL) {
				if (response.SerializeToArray(requestPointer, responseSize)) {
					messagingInterface->PostMessage(instance, responseVar);
				}
				bufferInterface->Unmap(responseVar);
			}
			varInterface->Release(responseVar);

			return FJS_Error_Ok;
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
		case furious::Request_Type_CHOLESKY_DECOMPOSITION:
		{
			const furious::CholeskyDecompositionRequest& choleskyDecomposition = request.cholesky_decomposition_request();
			return FJS_Execute_CholeskyDecomposition(instance,
				choleskyDecomposition.id_a(),
				choleskyDecomposition.a_type() == furious::TriangularMatrixType::LOWER,
				choleskyDecomposition.id_out());
		}
		case furious::Request_Type_SOLVE_TRIANGULAR:
			const furious::SolveTriangularRequest& solveTriangular = request.solve_triangular_request();
			return FJS_Execute_SolveTriangular(instance,
				solveTriangular.id_a(),
				solveTriangular.id_y(),
				solveTriangular.id_x(),
				solveTriangular.a_type() == furious::TriangularMatrixType::LOWER,
				solveTriangular.a_transposition() == furious::TranspositionType::TRANSPOSE,
				solveTriangular.unit_diagonal());
	}
}
